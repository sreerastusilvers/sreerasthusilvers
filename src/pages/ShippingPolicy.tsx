import React from 'react';

const ShippingPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container-custom max-w-4xl">
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Shipping Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last Updated: February 17, 2026</p>

          <div className="prose prose-gray max-w-none space-y-8">
            {/* Introduction */}
            <section>
              <p className="text-gray-700 leading-relaxed">
                At Sreerasthu Silvers, we aim to deliver your jewellery safely and promptly.
              </p>
            </section>

            {/* Delivery Area */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Delivery Area</h2>
              <p className="text-gray-700 leading-relaxed">
                We deliver across India only.
              </p>
            </section>

            {/* Processing Time */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Processing Time</h2>
              <p className="text-gray-700 leading-relaxed">
                Orders are processed within 1–3 working days after confirmation.
              </p>
            </section>

            {/* Delivery Time */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Delivery Time</h2>
              <p className="text-gray-700 leading-relaxed">
                Estimated delivery time is 3–7 business days depending on location.
              </p>
            </section>

            {/* Shipping Charges */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Shipping Charges</h2>
              <p className="text-gray-700 leading-relaxed">
                Shipping charges (if any) will be displayed at checkout before payment.
              </p>
            </section>

            {/* Tracking */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Tracking</h2>
              <p className="text-gray-700 leading-relaxed">
                Tracking details will be shared via email or SMS once the order is dispatched.
              </p>
            </section>

            {/* Delays */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Delays</h2>
              <p className="text-gray-700 leading-relaxed">
                Delivery may be delayed due to unforeseen circumstances such as natural disasters, courier delays, or government restrictions.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShippingPolicy;
