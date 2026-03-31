import { Facebook, Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../assets/dark.png";

const Footer = () => {
  return (
    <footer className="bg-[#1a1a1a] dark:bg-card text-white relative overflow-visible">
        {/* Subtle top border accent */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        
        <div className="container-custom py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Logo & About */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <img src={logo} alt="Sreerasthu Silvers" className="h-14 w-auto mb-4 brightness-0 invert" />
            <p className="text-white/60 text-sm leading-relaxed mb-6 font-light">
              Your one-stop destination for premium silver jewelry, elegant furniture, exquisite articles, unique gift items, and sacred pooja items — crafted to celebrate every moment.
            </p>
            <div className="flex gap-3">
              <a 
                href="https://www.facebook.com/sreerasthusilvers" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-primary transition-colors"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a 
                href="https://www.instagram.com/sreerasthu_silvers/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-primary transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Shop Online */}
          <div>
            <h4 className="font-serif font-medium mb-4 text-white text-sm">Shop Online</h4>
            <ul className="space-y-2.5">
              {[
                { name: "Rings", path: "/shop/rings" },
                { name: "Earrings", path: "/shop/earrings" },
                { name: "Necklaces", path: "/shop/necklaces" },
                { name: "Bracelets", path: "/shop/bracelets" }
              ].map((link) => (
                <li key={link.name}>
                  <Link to={link.path} className="text-sm text-white/50 hover:text-white transition-colors font-light">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-serif font-medium mb-4 text-white text-sm">Categories</h4>
            <ul className="space-y-2.5">
              {[
                { name: "Jewelry", path: "/jewelry" },
                { name: "Furniture", path: "/furniture" },
                { name: "Articles", path: "/articles" },
                { name: "Other Products", path: "/products" }
              ].map((link) => (
                <li key={link.name}>
                  <Link to={link.path} className="text-sm text-white/50 hover:text-white transition-colors font-light">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Information */}
          <div>
            <h4 className="font-serif font-medium mb-4 text-white text-sm">Information</h4>
            <ul className="space-y-2.5">
              {[
                { name: "Privacy Policy", path: "/privacy-policy" },
                { name: "Terms & Conditions", path: "/terms-conditions" },
                { name: "Shipping Policy", path: "/shipping-policy" },
                { name: "Cancellation & Refund", path: "/cancellation-refund-policy" }
              ].map((link) => (
                <li key={link.name}>
                  <Link to={link.path} className="text-sm text-white/50 hover:text-white transition-colors font-light">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-serif font-medium mb-4 text-white text-sm">Need Help?</h4>
            <ul className="space-y-2.5 text-sm text-white/50 font-light">
              <li>Ramasomayajulu street</li>
              <li>Ramaraopeta, Kakinada, Andhra Pradesh, India, 533001</li>
              <li>
                Tel: <a href="tel:+916304960489" className="hover:text-white transition-colors">+91 6304960489</a>
              </li>
              <li className="break-all">
                Email: <a href="mailto:sreerasthusilvers@gmail.com?subject=Inquiry%20about%20Sreerasthu%20Silvers&body=Hello%20Sreerasthu%20Silvers%20Team," className="hover:text-white transition-colors">sreerasthusilvers@gmail.com</a>
              </li>
            </ul>
            {/* Google Map */}
            <div className="mt-4 rounded-xl overflow-hidden">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2971.5777289331822!2d82.23205947387872!3d16.957781683857988!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a38290006734e2b%3A0x9f8b6cdf933bc2a!2sSreerastu%20silvers!5e1!3m2!1sen!2sin!4v1773164635883!5m2!1sen!2sin"
                width="100%"
                height="150"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Sreerasthu Silvers Store Location"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5">
        <div className="text-center text-xs text-white/40 px-4 font-light">
          <p className="mb-1">
            Copyright &copy; {new Date().getFullYear()} <span className="text-white/60 font-normal">Sreerasthu Silvers</span>. All Rights Reserved
          </p>
          <p>
            Designed & Developed by{" "}
            <a 
              href="https://www.thedreamteamservices.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white transition-colors font-normal whitespace-nowrap"
            >
              DREAM TEAM SERVICES
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
