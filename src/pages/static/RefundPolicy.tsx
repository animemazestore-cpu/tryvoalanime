import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

const PolicyPage: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <div className="bg-white p-8 sm:p-12 rounded-2xl border border-gray-200 shadow-sm space-y-8">
      <div className="border-b border-gray-200 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-3">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Customer Assurance</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-500 mt-2">Effective Date: June 20, 2026 • TRYVOAL Care Guarantee</p>
      </div>
      <div className="space-y-8 text-sm text-gray-600 leading-relaxed">
        {children}
      </div>
    </div>
  </div>
);

const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section className="space-y-2">
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
    </div>
    <div className="text-gray-600 space-y-2 pl-0 sm:pl-6">{children}</div>
  </section>
);

export const RefundPolicy: React.FC = () => (
  <PolicyPage title="Refund, Replacement & Return Policy">
    <p>
      At <strong>TRYVOAL</strong>, fan satisfaction and product excellence are central to our brand. We understand that purchasing authentic anime streetwear, graphic hoodies, and limited collectibles online requires complete confidence in transit protection, sizing accuracy, and print quality.
    </p>

    <Section title="1. 100% Transit Protection Guarantee" icon={<ShieldCheck className="h-4 w-4 text-primary" />}>
      <p>
        Every single shipment is dispatched in reinforced, weatherproof anime-grade packaging and fully covered under our <strong>Transit Protection Guarantee</strong>:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>If your product arrives damaged, torn, broken, or defective during shipping, we will dispatch an immediate <strong>free priority replacement</strong>.</li>
        <li>To initiate a claim, take clear photos or a short video upon unboxing the parcel and notify us at <a href="mailto:muhammad1211junaid@gmail.com" className="text-primary font-bold hover:underline">muhammad1211junaid@gmail.com</a> or via your Dashboard within <strong>7 days of delivery</strong>.</li>
      </ul>
    </Section>

    <Section title="2. 7-Day Return & Replacement Eligibility" icon={<CheckCircle2 className="h-4 w-4 text-primary" />}>
      <p>You may request a return or replacement under the following qualifying conditions:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>The product delivered does not match the ordered anime design, size, or edition.</li>
        <li>The garment or collectible exhibits verified manufacturing, fabric, stitching, or print defects.</li>
        <li>You wish to exchange for an alternative size or anime design from our catalog within 7 days of receiving the package.</li>
      </ul>
    </Section>

    <Section title="3. Mandatory Conditions for Return Acceptance" icon={<AlertTriangle className="h-4 w-4 text-primary" />}>
      <p>Due to hygiene and collector integrity standards, returned products must satisfy the following criteria:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Unworn Condition:</strong> Apparel must be unworn, unwashed, free from perfumes or pet hair, and in pristine condition with all original tags attached.</li>
        <li><strong>Original Packaging:</strong> Action figures, statues, katanas, watches, and accessories must remain in their original collector boxes with all protective blister packs intact.</li>
        <li><strong>Limited Drop Items:</strong> Custom-tailored or specially commissioned merchandise is non-returnable except in cases of verified transit damage or defect.</li>
      </ul>
    </Section>

    <Section title="4. Complimentary Reverse Freight Logistics" icon={<RefreshCw className="h-4 w-4 text-primary" />}>
      <p>
        For approved returns or replacements, TRYVOAL arranges complimentary reverse freight pickup from your delivery address via our doorstep courier partners. If reverse pickup is unavailable in certain remote pincodes, our concierge will coordinate and reimburse verified shipping costs.
      </p>
    </Section>

    <Section title="5. Refund Processing Timelines">
      <p>
        Once the returned shipment is received and inspected at our central fulfillment warehouse (typically within 2 business days of arrival):
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>The refund will be credited directly back to the original UPI payment method or bank account via <strong>Trust Gateway</strong>.</li>
        <li>Refunds typically reflect in your bank account or UPI app within <strong>3 to 5 business days</strong> depending on your banking provider.</li>
        <li>You will receive an automated email notification once the refund transaction is executed.</li>
      </ul>
    </Section>

    <Section title="6. How to Submit a Return or Replacement Request" icon={<HelpCircle className="h-4 w-4 text-primary" />}>
      <p>
        Log into your account, visit your <a href="/dashboard" className="text-primary font-bold hover:underline">Customer Dashboard</a>, and navigate to the <strong>Orders & Replacements</strong> tab to submit your request, or email our concierge team directly at <a href="mailto:muhammad1211junaid@gmail.com" className="text-primary font-bold hover:underline">muhammad1211junaid@gmail.com</a> or call <a href="tel:+917055435358" className="text-primary font-bold hover:underline">+91 70554 35358</a> with your Order ID and photos.
      </p>
    </Section>
  </PolicyPage>
);
