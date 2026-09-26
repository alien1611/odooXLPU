const { AppError } = require('./authService');

/**
 * Creates a new cost layer upon inventory receipt.
 *
 * @param {Object} client - PostgreSQL transactional client
 * @param {Object} params
 * @param {number} params.productId
 * @param {number|null} [params.stockMoveId]
 * @param {number} params.quantity
 * @param {number} params.unitCost
 */
async function createCostLayer(client, { productId, stockMoveId = null, quantity, unitCost }) {
  const pId = parseInt(productId, 10);
  const moveId = stockMoveId ? parseInt(stockMoveId, 10) : null;
  const qty = parseFloat(quantity);
  const cost = parseFloat(unitCost);

  if (qty <= 0) {
    throw new AppError('Cost layer initial quantity must be greater than 0.', 400, 'VALIDATION_ERROR');
  }
  if (cost < 0) {
    throw new AppError('Cost layer unit cost cannot be negative.', 400, 'VALIDATION_ERROR');
  }

  const insertSql = `
    INSERT INTO cost_layers (product_id, stock_move_id, initial_qty, remaining_qty, unit_cost, created_at, updated_at)
    VALUES ($1, $2, $3, $3, $4, NOW(), NOW())
    RETURNING id, product_id, stock_move_id, initial_qty, remaining_qty, unit_cost, created_at;
  `;
  const res = await client.query(insertSql, [pId, moveId, qty, cost]);
  return res.rows[0];
}

/**
 * Recalculates and updates the weighted-average cost of a product upon receipt.
 *
 * Formula:
 * new_avg_cost = ((current_qty * current_avg_cost) + (received_qty * received_unit_cost)) / (current_qty + received_qty)
 *
 * @param {Object} client - PostgreSQL transactional client
 * @param {Object} params
 * @param {number} params.productId
 * @param {number} params.receivedQty
 * @param {number} params.receivedUnitCost
 */
async function updateProductWeightedAverageCost(client, { productId, receivedQty, receivedUnitCost }) {
  const pId = parseInt(productId, 10);
  const rQty = parseFloat(receivedQty);
  const rCost = parseFloat(receivedUnitCost);

  // Lock product row to ensure serialized cost calculation
  const prodRes = await client.query(
    'SELECT id, cost_price, name FROM products WHERE id = $1 FOR UPDATE',
    [pId]
  );

  if (prodRes.rows.length === 0) {
    throw new AppError(`Product ID ${pId} not found.`, 404, 'NOT_FOUND');
  }

  const product = prodRes.rows[0];
  const currentAvgCost = parseFloat(product.cost_price || 0);

  // Get current total on-hand stock across all quants (which already reflects this receipt's adjustQuant)
  const quantRes = await client.query(
    'SELECT COALESCE(SUM(quantity), 0) AS total_on_hand FROM stock_quants WHERE product_id = $1',
    [pId]
  );
  const totalQtyAfter = parseFloat(quantRes.rows[0].total_on_hand || 0);
  const previousQty = totalQtyAfter - rQty;

  let newAvgCost = rCost;

  if (previousQty > 0 && totalQtyAfter > 0) {
    const totalValuation = (previousQty * currentAvgCost) + (rQty * rCost);
    newAvgCost = Math.round((totalValuation / totalQtyAfter) * 10000) / 10000;
  } else {
    // If no stock existed prior to this receipt, the new weighted average is the received unit cost
    newAvgCost = Math.round(rCost * 10000) / 10000;
  }

  await client.query(
    'UPDATE products SET cost_price = $1, updated_at = NOW() WHERE id = $2',
    [newAvgCost, pId]
  );

  return newAvgCost;
}

/**
 * Depletes remaining quantity in cost layers upon consumption (FIFO layer depletion).
 * Preserves historical layers with remaining_qty = 0 for perpetual valuation audit.
 *
 * @param {Object} client - PostgreSQL transactional client
 * @param {Object} params
 * @param {number} params.productId
 * @param {number} params.quantity - Quantity consumed
 */
async function depleteCostLayers(client, { productId, quantity }) {
  const pId = parseInt(productId, 10);
  let qtyToDeplete = parseFloat(quantity);

  if (qtyToDeplete <= 0) return [];

  // Lock available cost layers in FIFO order
  const layersRes = await client.query(
    `SELECT id, remaining_qty, unit_cost 
     FROM cost_layers 
     WHERE product_id = $1 AND remaining_qty > 0 
     ORDER BY created_at ASC, id ASC 
     FOR UPDATE`,
    [pId]
  );

  const depletedLayers = [];

  for (const layer of layersRes.rows) {
    if (qtyToDeplete <= 0) break;

    const layerRemaining = parseFloat(layer.remaining_qty);
    const deduct = Math.min(layerRemaining, qtyToDeplete);
    const newRemaining = Math.round((layerRemaining - deduct) * 10000) / 10000;

    await client.query(
      'UPDATE cost_layers SET remaining_qty = $1, updated_at = NOW() WHERE id = $2',
      [newRemaining, layer.id]
    );

    depletedLayers.push({
      layerId: layer.id,
      deductedQty: deduct,
      unitCost: parseFloat(layer.unit_cost)
    });

    qtyToDeplete = Math.round((qtyToDeplete - deduct) * 10000) / 10000;
  }

  return depletedLayers;
}

module.exports = {
  createCostLayer,
  updateProductWeightedAverageCost,
  depleteCostLayers
};
