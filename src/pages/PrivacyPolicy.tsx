import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container-custom max-w-4xl">
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Effective Date: February 17, 2026</p>

          <div className="prose prose-gray max-w-none space-y-8">
            {/* Introduction */}
            <section>
              <p className="text-gray-700 leading-relaxed">
                Sree Rasthu Silvers ("we", "our", "us") operates the website <a href="https://sreerasthusilvers.vercel.app/" className="text-blue-600 hover:underline">https://sreerasthusilvers.vercel.app/</a>. 
                We value your privacy and are committed to protecting your personal information.
              </p>
            </section>

            {/* Information We Collect */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Information We Collect</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                We may collect the following information when you use our website:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Full Name</li>
                <li>Email Address</li>
                <li>Phone Number</li>
                <li>Shipping Address</li>
                <li>Billing Address</li>
                <li>Order Details</li>
                <li>Device and browser information</li>
              </ul>
            </section>

            {/* How We Use Information */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                We use your information to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Process and deliver your orders</li>
                <li>Provide customer support</li>
                <li>Send order confirmations and updates</li>
                <li>Improve our services</li>
                <li>Prevent fraud and misuse</li>
              </ul>
            </section>

            {/* Payment Information */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Payment Information</h2>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-gray-800 leading-relaxed">
                  <strong className="text-blue-700">All online payments are processed securely through Razorpay.</strong> We do not store your credit/debit card details, UPI credentials, or banking information on our servers.
                </p>
              </div>
            </section>

            {/* Data Security */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Data Security</h2>
              <p className="text-gray-700 leading-relaxed">
                We implement reasonable security measures to protect your personal data. However, no method of transmission over the internet is 100% secure.
              </p>
            </section>

            {/* Sharing Information */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Sharing of Information</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                We do not sell, rent, or trade your personal information. We may share data with:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Payment gateways (Razorpay)</li>
                <li>Shipping partners</li>
                <li>Government authorities if legally required</li>
              </ul>
            </section>

            {/* Contact Information */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Contact Us</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                For any privacy-related concerns, contact:
              </p>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <p className="text-gray-700"><strong>Email:</strong> <a href="mailto:sreerasthusilvers@gmail.com" className="text-blue-600 hover:underline">sreerasthusilvers@gmail.com</a></p>
                <p className="text-gray-700 mt-2"><strong>Phone:</strong> +91 63049 60489</p>
                <div className="mt-4">
                  <p className="text-gray-700 font-semibold">Address:</p>
                  <p className="text-gray-700">Sree Rasthu Silvers</p>
                  <p className="text-gray-700">Ramasomayajulu St,</p>
                  <p className="text-gray-700">Rama Rao Peta, Kakinada,</p>
                  <p className="text-gray-700">Andhra Pradesh – 533001, India</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
