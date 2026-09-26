import React from 'react';
import { X, Printer, Truck, FileText, CheckCircle2, Package, ShieldCheck } from 'lucide-react';

export default function ShippingDocumentModal({ isOpen, onClose, documentType, documentData }) {
  if (!isOpen || !documentData) return null;

  const handlePrint = () => {
    window.print();
  };

  const isBOL = documentType === 'BILL_OF_LADING' || documentData.document_type === 'BILL_OF_LADING';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in max-h-[92vh] flex flex-col">
        {/* Modal Controls (Hidden in Print) */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            {isBOL ? (
              <Truck className="w-5 h-5 text-indigo-600" />
            ) : (
              <FileText className="w-5 h-5 text-blue-600" />
            )}
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              {isBOL ? 'Bill of Lading (BOL)' : 'Warehouse Packing Slip'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Document
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 overflow-y-auto print:p-0 print:m-0 text-slate-900 bg-white">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-slate-900 text-white font-black text-sm tracking-wider rounded">
                  STOCKYARD
                </span>
                <span className="font-bold text-slate-700 text-sm tracking-tight uppercase">
                  Logistics & Fulfillment
                </span>
              </div>
              <h1 className="text-2xl font-black uppercase tracking-tight mt-1 text-slate-900">
                {isBOL ? 'Uniform Straight Bill of Lading' : 'Warehouse Packing Slip'}
              </h1>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Document Ref: <strong className="text-slate-800">{documentData.document_number}</strong>
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-500 uppercase">Issued Date</div>
              <div className="text-xs font-mono font-bold text-slate-900">
                {new Date(documentData.issued_date || documentData.bol_date).toLocaleString()}
              </div>
              <div className="mt-1">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Certified Dispatch
                </span>
              </div>
            </div>
          </div>

          {/* Parties & Facilities Matrix */}
          <div className="grid grid-cols-2 gap-6 my-4 p-3 bg-slate-50 rounded border border-slate-200 text-xs">
            <div>
              <span className="font-bold text-[10px] uppercase text-slate-500 tracking-wider block mb-1">
                Shipper / Origin Facility
              </span>
              <div className="font-bold text-slate-800 text-sm">
                {isBOL ? documentData.shipper?.facility_name : documentData.warehouse?.name}
              </div>
              <div className="text-slate-600 font-mono text-[11px]">
                Facility Code: {isBOL ? documentData.shipper?.facility_code : documentData.warehouse?.code}
              </div>
              <div className="text-slate-500 text-[11px] mt-0.5">
                Dock Operations &bull; Stockyard Immutable Ledger Verified
              </div>
            </div>

            <div>
              <span className="font-bold text-[10px] uppercase text-slate-500 tracking-wider block mb-1">
                Consignee / Destination
              </span>
              <div className="font-bold text-slate-800 text-sm">
                {isBOL ? documentData.consignee?.customer_name : documentData.delivery?.customer_name}
              </div>
              <div className="text-slate-600 font-mono text-[11px]">
                Order Reference: {isBOL ? documentData.consignee?.delivery_reference : documentData.delivery?.reference}
              </div>
              <div className="text-slate-500 text-[11px] mt-0.5">
                Standard Commercial Inbound Dock
              </div>
            </div>
          </div>

          {/* Carrier & Shipment Header */}
          <div className="grid grid-cols-3 gap-3 my-3 p-3 bg-blue-50/60 rounded border border-blue-200 text-xs">
            <div>
              <span className="text-[10px] font-semibold text-blue-700 uppercase block">Carrier Name</span>
              <span className="font-bold text-slate-900 block mt-0.5">
                {isBOL
                  ? documentData.carrier_info?.carrier_name
                  : (documentData.package?.carrier?.name || 'Unassigned Local Freight')}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-blue-700 uppercase block">Service Level</span>
              <span className="font-medium text-slate-800 block mt-0.5">
                {isBOL
                  ? documentData.carrier_info?.service_level
                  : (documentData.package?.carrier?.service || 'Standard Freight')}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-blue-700 uppercase block">Local Tracking Reference</span>
              <span className="font-mono font-bold text-blue-800 block mt-0.5">
                {isBOL
                  ? documentData.carrier_info?.pro_tracking_number
                  : (documentData.package?.carrier?.tracking_number || 'PENDING DISPATCH')}
              </span>
            </div>
          </div>

          {/* Cartonization & Weight Specs */}
          {!isBOL && documentData.package && (
            <div className="my-4 p-3 bg-slate-100 rounded border border-slate-200 text-xs grid grid-cols-4 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Package Ref</span>
                <span className="font-mono font-bold text-slate-800">{documentData.package.package_number}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Dimensions</span>
                <span className="font-mono text-slate-800">
                  {documentData.package.dimensions.length}×{documentData.package.dimensions.width}×{documentData.package.dimensions.height} {documentData.package.dimensions.unit}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Gross / Tare Wt</span>
                <span className="font-mono text-slate-800">
                  {documentData.package.weights.gross_weight} / {documentData.package.weights.tare_weight} {documentData.package.weights.unit}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Net Weight</span>
                <span className="font-mono font-bold text-emerald-700">
                  {documentData.package.weights.net_weight} {documentData.package.weights.unit}
                </span>
              </div>
            </div>
          )}

          {/* BOL Handling Units Table */}
          {isBOL && documentData.handling_units && (
            <div className="my-4">
              <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider mb-1.5">
                Handling Units / Packaging Summary
              </h3>
              <table className="w-full text-left text-xs border border-slate-300">
                <thead className="bg-slate-100 border-b border-slate-300 text-[10px] uppercase font-semibold text-slate-600">
                  <tr>
                    <th className="py-1.5 px-2 border-r border-slate-300">Package #</th>
                    <th className="py-1.5 px-2 border-r border-slate-300">Type</th>
                    <th className="py-1.5 px-2 border-r border-slate-300">Dimensions</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 text-right">Gross Wt</th>
                    <th className="py-1.5 px-2 border-r border-slate-300 text-right">Net Wt</th>
                    <th className="py-1.5 px-2 text-right">Pieces</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {documentData.handling_units.map((hu, idx) => (
                    <tr key={idx}>
                      <td className="py-1 px-2 font-mono font-bold text-blue-800 border-r border-slate-200">{hu.package_number}</td>
                      <td className="py-1 px-2 uppercase border-r border-slate-200">{hu.type}</td>
                      <td className="py-1 px-2 font-mono border-r border-slate-200">{hu.dimensions}</td>
                      <td className="py-1 px-2 text-right font-mono border-r border-slate-200">{hu.gross_weight}</td>
                      <td className="py-1 px-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">{hu.net_weight}</td>
                      <td className="py-1 px-2 text-right font-mono font-bold">{hu.pieces}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                  <tr>
                    <td colSpan="3" className="py-1.5 px-2 uppercase text-[10px] text-slate-600 border-r border-slate-200">
                      Total Shipment Handling Units: {documentData.shipment_summary?.total_handling_units}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono border-r border-slate-200">
                      {documentData.shipment_summary?.total_gross_weight} {documentData.shipment_summary?.weight_unit}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-emerald-800 border-r border-slate-200">
                      {documentData.shipment_summary?.total_net_weight} {documentData.shipment_summary?.weight_unit}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono">
                      {documentData.shipment_summary?.total_pieces} units
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Commodities / Line Items Table */}
          <div className="my-4">
            <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider mb-1.5">
              {isBOL ? 'Commodity Item Description & Lot Records' : 'Packed Carton Contents'}
            </h3>
            <table className="w-full text-left text-xs border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300 text-[10px] uppercase font-semibold text-slate-600">
                <tr>
                  <th className="py-1.5 px-2 border-r border-slate-300 w-8">#</th>
                  <th className="py-1.5 px-2 border-r border-slate-300">Product Description</th>
                  <th className="py-1.5 px-2 border-r border-slate-300">SKU</th>
                  <th className="py-1.5 px-2 border-r border-slate-300">Lot / Batch #</th>
                  {!isBOL && <th className="py-1.5 px-2 border-r border-slate-300">Expiry</th>}
                  <th className="py-1.5 px-2 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(isBOL ? documentData.commodities : documentData.items)?.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1.5 px-2 text-slate-400 font-mono border-r border-slate-200">{idx + 1}</td>
                    <td className="py-1.5 px-2 font-semibold text-slate-800 border-r border-slate-200">
                      {item.description || item.product_name}
                    </td>
                    <td className="py-1.5 px-2 font-mono text-slate-600 border-r border-slate-200">{item.sku}</td>
                    <td className="py-1.5 px-2 font-mono text-blue-700 border-r border-slate-200">
                      {item.lot_batch || item.lot_number || 'N/A'}
                    </td>
                    {!isBOL && (
                      <td className="py-1.5 px-2 font-mono text-slate-500 border-r border-slate-200">
                        {item.expiry_date ? new Date(item.expiry_date).toISOString().slice(0, 10) : '—'}
                      </td>
                    )}
                    <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                      {item.quantity || `${item.packed_qty} ${item.uom}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legal / Special Instructions & Certifications */}
          <div className="my-4 text-[10px] text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed">
            <strong>Certifications & Handling:</strong> {documentData.certification || 'Verified according to Stockyard quality management standards. Packed with FEFO rotation audit.'}
            {documentData.special_instructions && (
              <div className="mt-1 text-slate-700">
                <strong>Instructions:</strong> {documentData.special_instructions}
              </div>
            )}
          </div>

          {/* Signatures Block */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t-2 border-slate-300 mt-6 text-xs">
            <div>
              <div className="border-b border-slate-400 h-8"></div>
              <div className="text-[10px] font-bold text-slate-600 uppercase mt-1">Shipper Signature / Date</div>
              <div className="text-[10px] text-slate-400">Stockyard Warehouse Associate</div>
            </div>
            <div>
              <div className="border-b border-slate-400 h-8"></div>
              <div className="text-[10px] font-bold text-slate-600 uppercase mt-1">Carrier Driver Signature / Date</div>
              <div className="text-[10px] text-slate-400">Freight Transport Custody</div>
            </div>
            <div>
              <div className="border-b border-slate-400 h-8"></div>
              <div className="text-[10px] font-bold text-slate-600 uppercase mt-1">Consignee Receiving / Date</div>
              <div className="text-[10px] text-slate-400">Customer Proof of Delivery</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
