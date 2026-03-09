import React from 'react';

const TermsConditions = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container-custom max-w-4xl">
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms and Conditions</h1>
          <p className="text-sm text-gray-500 mb-8">Effective Date: February 17, 2026</p>

          <div className="prose prose-gray max-w-none space-y-8">
            {/* Introduction */}
            <section>
              <p className="text-gray-700 leading-relaxed">
                By accessing <a href="https://sreerasthusilvers.vercel.app/" className="text-blue-600 hover:underline">https://sreerasthusilvers.vercel.app/</a>, you agree to be bound by these terms.
              </p>
            </section>

            {/* Products & Pricing */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Products & Pricing</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>All prices are listed in INR (₹). We reserve the right to change prices at any time without prior notice.</li>
                <li>Product images are for representation purposes. Slight variations may occur due to lighting and photography.</li>
              </ul>
            </section>

            {/* Orders */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Orders</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                We reserve the right to cancel any order due to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Pricing errors</li>
                <li>Product unavailability</li>
                <li>Suspicious or fraudulent activity</li>
              </ul>
            </section>

            {/* Payments */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Payments</h2>
              <p className="text-gray-700 leading-relaxed">
                We accept online payments securely through Razorpay. We also offer Cash on Delivery (if applicable).
              </p>
            </section>

            {/* Shipping */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Shipping</h2>
              <p className="text-gray-700 leading-relaxed">
                We deliver across India only. Delivery timelines are mentioned in our Shipping Policy.
              </p>
            </section>

            {/* Returns */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Returns</h2>
              <p className="text-gray-700 leading-relaxed">
                Product returns are governed by our Return & Replacement Policy. We offer product replacements for eligible items.
              </p>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Governing Law</h2>
              <p className="text-gray-700 leading-relaxed">
                These terms shall be governed by the laws of India.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsConditions;
