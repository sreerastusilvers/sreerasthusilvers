import React from 'react';

const CancellationRefundPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container-custom max-w-4xl">
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Cancellation & Refund Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last Updated: February 17, 2026</p>

          <div className="prose prose-gray max-w-none space-y-8">
            {/* Introduction */}
            <section>
              <p className="text-gray-700 leading-relaxed">
                At Sreerasthu Silvers, customer satisfaction is our priority.
              </p>
            </section>

            {/* Return Window */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Return Window</h2>
              <p className="text-gray-700 leading-relaxed">
                Customers may request a return within 7 days from the date of delivery.
              </p>
            </section>

            {/* Eligibility for Return */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Eligibility for Return</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                Products must:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Be unused</li>
                <li>Be in original packaging</li>
                <li>Include invoice and tags</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                Customized or damaged products are not eligible for return.
              </p>
            </section>

            {/* Cancellation */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Cancellation</h2>
              <p className="text-gray-700 leading-relaxed">
                Orders can be cancelled before dispatch. Once shipped, cancellation is not allowed.
              </p>
            </section>

            {/* Refund Process */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Refund Process</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                After we receive and inspect the returned product:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Refund will be processed within 7 business days.</li>
                <li>For prepaid orders, refund will be made to the original payment method.</li>
                <li>For Cash on Delivery (COD) orders, refund will be processed to the customer's bank account after verification.</li>
              </ul>
            </section>

            {/* Non-Refundable Cases */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Non-Refundable Cases</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Used products</li>
                <li>Damaged items not due to shipping</li>
                <li>Requests after 7 days</li>
              </ul>
            </section>

            {/* Contact for Refund Assistance */}
            <section>
              <p className="text-gray-700 leading-relaxed mb-2">
                <strong>For refund assistance:</strong>
              </p>
              <p className="text-gray-700">Email: <a href="mailto:sreerasthusilvers@gmail.com" className="text-blue-600 hover:underline">sreerasthusilvers@gmail.com</a></p>
              <p className="text-gray-700">Phone: +91 63049 60489</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancellationRefundPolicy;
