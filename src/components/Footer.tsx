import { Facebook, Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../assets/logo-new.png";

const Footer = () => {
  return (
    <div className="px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8">
      <footer className="bg-black text-white relative overflow-visible">
        {/* Top Wave Border */}
        <div className="absolute top-0 overflow-hidden -left-4 -right-4 md:-left-6 md:-right-6 lg:-left-8 lg:-right-8" style={{ height: '30px', transform: 'translateY(-100%)' }}>
          <svg 
            viewBox="0 0 1200 30" 
            preserveAspectRatio="none" 
            className="w-full h-full"
            style={{ display: 'block' }}
          >
            <path 
              d="M0,15 Q150,0 300,15 T600,15 T900,15 T1200,15 L1200,30 L0,30 Z" 
              fill="#000000"
            />
          </svg>
        </div>
        
        {/* Left Wave Border */}
        <div className="absolute top-0 left-0 bottom-0 overflow-hidden" style={{ width: '30px', transform: 'translateX(-100%)' }}>
          <svg 
            viewBox="0 0 30 1200" 
            preserveAspectRatio="none" 
            className="w-full h-full"
            style={{ display: 'block' }}
          >
            <path 
              d="M15,0 Q0,150 15,300 T15,600 T15,900 T15,1200 L30,1200 L30,0 Z" 
              fill="#000000"
            />
          </svg>
        </div>
        
        {/* Right Wave Border */}
        <div className="absolute top-0 right-0 bottom-0 overflow-hidden" style={{ width: '30px', transform: 'translateX(100%)' }}>
          <svg 
            viewBox="0 0 30 1200" 
            preserveAspectRatio="none" 
            className="w-full h-full"
            style={{ display: 'block' }}
          >
            <path 
              d="M15,0 Q30,150 15,300 T15,600 T15,900 T15,1200 L0,1200 L0,0 Z" 
              fill="#000000"
            />
          </svg>
        </div>
        
        {/* Bottom Wave Border */}
        <div className="absolute bottom-0 overflow-hidden -left-4 -right-4 md:-left-6 md:-right-6 lg:-left-8 lg:-right-8" style={{ height: '30px', transform: 'translateY(100%)' }}>
          <svg 
            viewBox="0 0 1200 30" 
            preserveAspectRatio="none" 
            className="w-full h-full"
            style={{ display: 'block' }}
          >
            <path 
              d="M0,15 Q150,30 300,15 T600,15 T900,15 T1200,15 L1200,0 L0,0 Z" 
              fill="#000000"
            />
          </svg>
        </div>
        
        <div className="container-custom py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Logo & About */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <img src={logo} alt="Sreerasthu Silvers" className="h-14 w-auto mb-4 brightness-0 invert" />
            <p className="text-white/80 text-sm leading-relaxed mb-6">
              Timeless jewelry, ethically sourced. We believe in the power of jewelry — to tell a story, celebrate a moment.
            </p>
            <div className="flex gap-3">
              <a 
                href="https://www.facebook.com/sreerasthusilvers" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/20 hover:bg-white hover:text-black transition-colors"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a 
                href="https://www.instagram.com/sreerasthu_silvers/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/20 hover:bg-white hover:text-black transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Shop Online */}
          <div>
            <h4 className="font-heading font-medium mb-4 text-white">Shop Online</h4>
            <ul className="space-y-2">
              {[
                { name: "Rings", path: "/shop/rings" },
                { name: "Earrings", path: "/shop/earrings" },
                { name: "Necklaces", path: "/shop/necklaces" },
                { name: "Bracelets", path: "/shop/bracelets" }
              ].map((link) => (
                <li key={link.name}>
                  <Link to={link.path} className="text-sm text-white/70 hover:text-white transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-heading font-medium mb-4 text-white">Categories</h4>
            <ul className="space-y-2">
              {[
                { name: "Jewelry", path: "/jewelry" },
                { name: "Furniture", path: "/furniture" },
                { name: "Articles", path: "/articles" },
                { name: "Other Products", path: "/products" }
              ].map((link) => (
                <li key={link.name}>
                  <Link to={link.path} className="text-sm text-white/70 hover:text-white transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Information */}
          <div>
            <h4 className="font-heading font-medium mb-4 text-white">Information</h4>
            <ul className="space-y-2">
              {[
                { name: "Privacy Policy", path: "/privacy-policy" },
                { name: "Terms & Conditions", path: "/terms-conditions" },
                { name: "Shipping Policy", path: "/shipping-policy" },
                { name: "Cancellation & Refund", path: "/cancellation-refund-policy" }
              ].map((link) => (
                <li key={link.name}>
                  <Link to={link.path} className="text-sm text-white/70 hover:text-white transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-medium mb-4 text-white">Need Help?</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li>Ramasomayajulu street</li>
              <li>Ramaraopeta, Kakinada, Andhra Pradesh, India, 533001</li>
              <li>
                Tel: <a href="tel:+916304960489" className="hover:text-white transition-colors">+91 6304960489</a>
              </li>
              <li className="break-all">
                Email: <a href="mailto:sreerasthusilvers@gmail.com?subject=Inquiry%20about%20Sreerasthu%20Silvers&body=Hello%20Sreerasthu%20Silvers%20Team," className="hover:text-white transition-colors">sreerasthusilvers@gmail.com</a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/20 py-6">
        <div className="text-center text-sm text-white/70 px-4">
          <p className="mb-1">
            Copyright © 2025 <span className="text-white font-medium">Sreerasthu Silvers</span>. All Rights Reserved
          </p>
          <p>
            Designed & Developed by{" "}
            <a 
              href="https://www.thedreamteamservices.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white hover:text-white/80 transition-colors font-medium whitespace-nowrap"
            >
              DREAM TEAM SERVICES
            </a>
          </p>
        </div>
      </div>
    </footer>
    </div>
  );
};

export default Footer;
