import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useToast } from '@/hooks/use-toast';
import {
  getUserAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  Address,
  AddressFormData,
} from '@/services/addressService';
import {
  ArrowLeft,
  Plus,
  MapPin,
  Phone,
  Mail,
  Edit2,
  Trash2,
  Check,
  X,
  Home,
  Loader2,
  MoreVertical,
} from 'lucide-react';

const SavedAddresses = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<AddressFormData>({
    fullName: '',
    phoneNumber: '',
    pinCode: '',
    locality: '',
    address: '',
    city: '',
    state: '',
    isDefault: false,
  });

  // Fetch addresses on mount
  useEffect(() => {
    if (user) {
      loadAddresses();
    }
  }, [user]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.menu-container')) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuId]);

  const loadAddresses = async () => {
    if (!user) return;
    
    try {
      const userAddresses = await getUserAddresses(user.uid);
      setAddresses(userAddresses);
    } catch (error) {
      console.error('Error loading addresses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load addresses',
        variant: 'destructive',
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (!formData.fullName || !formData.phoneNumber || !formData.pinCode || 
        !formData.address || !formData.city || !formData.state) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setFormLoading(true);

      if (editingAddress) {
        // Update existing address
        await updateAddress(user.uid, editingAddress.id, formData);
        toast({
          title: 'Success',
          description: '✓ Address updated successfully',
        });
      } else {
        // Add new address
        await addAddress(user.uid, formData);
        toast({
          title: 'Success',
          description: '✓ Address added successfully',
        });
      }

      // Reset form and reload addresses
      resetForm();
      await loadAddresses();
    } catch (error) {
      console.error('Error saving address:', error);
      toast({
        title: 'Error',
        description: 'Failed to save address',
        variant: 'destructive',
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      fullName: address.fullName,
      phoneNumber: address.phoneNumber,
      pinCode: address.pinCode,
      locality: address.locality,
      address: address.address,
      city: address.city,
      state: address.state,
      isDefault: address.isDefault,
    });
    setShowForm(true);
  };

  const handleDelete = async (addressId: string) => {
    if (!user) return;
    
    if (window.confirm('Are you sure you want to delete this address?')) {
      try {
        await deleteAddress(user.uid, addressId);
        toast({
          title: 'Success',
          description: 'Address deleted successfully',
        });
        await loadAddresses();
      } catch (error) {
        console.error('Error deleting address:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete address',
          variant: 'destructive',
        });
      }
    }
  };

  const handleSetDefault = async (addressId: string) => {
    if (!user) return;

    try {
      await setDefaultAddress(user.uid, addressId);
      toast({
        title: 'Success',
        description: 'Default address updated',
      });
      await loadAddresses();
    } catch (error) {
      console.error('Error setting default:', error);
      toast({
        title: 'Error',
        description: 'Failed to update default address',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      phoneNumber: '',
      pinCode: '',
      locality: '',
      address: '',
      city: '',
      state: '',
      isDefault: false,
    });
    setEditingAddress(null);
    setShowForm(false);
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <div className="container mx-auto px-4 py-4 max-w-4xl pb-24">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  if (showForm) {
                    resetForm();
                  } else {
                    navigate('/account');
                  }
                }}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-700" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>Addresses</h1>
              </div>
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 border-2 border-blue-600 bg-transparent hover:bg-blue-50 text-blue-600 text-sm px-4 py-2 rounded-full transition-colors font-medium"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            )}
          </div>

          {/* Address Form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-8"
              >
                <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {editingAddress ? 'Edit Address' : 'Add New Address'}
                    </h2>
                    <button
                      onClick={resetForm}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Full Name */}
                    <div>
                      <Label htmlFor="fullName" className="text-sm font-medium text-gray-700 mb-2 block" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        Full Name *
                      </Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        placeholder="Enter your full name"
                        className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* Phone Number */}
                    <div>
                      <Label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700 mb-2 block" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        Phone Number *
                      </Label>
                      <Input
                        id="phoneNumber"
                        name="phoneNumber"
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={handleInputChange}
                        placeholder="10-digit mobile number"
                        className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* Pin Code & Locality */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="pinCode" className="text-sm font-medium text-gray-700 mb-2 block" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          Pin Code *
                        </Label>
                        <Input
                          id="pinCode"
                          name="pinCode"
                          value={formData.pinCode}
                          onChange={handleInputChange}
                          placeholder="6-digit PIN code"
                          maxLength={6}
                          className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="locality" className="text-sm font-medium text-gray-700 mb-2 block" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          Locality
                        </Label>
                        <Input
                          id="locality"
                          name="locality"
                          value={formData.locality}
                          onChange={handleInputChange}
                          placeholder="Locality/Town"
                          className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <Label htmlFor="address" className="text-sm font-medium text-gray-700 mb-2 block" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        Address (Area and Street) *
                      </Label>
                      <Input
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        placeholder="Flat/House No., Building, Street"
                        className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* City & State */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="city" className="text-sm font-medium text-gray-700 mb-2 block" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          City *
                        </Label>
                        <Input
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          placeholder="City"
                          className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="state" className="text-sm font-medium text-gray-700 mb-2 block" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          State *
                        </Label>
                        <Input
                          id="state"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          placeholder="State"
                          className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>

                    {/* Set as Default */}
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={formData.isDefault}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, isDefault: e.target.checked }))
                        }
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <Label htmlFor="isDefault" className="text-sm font-medium text-gray-700 cursor-pointer" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        Set as default shipping address
                      </Label>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex space-x-4 pt-4">
                      <Button
                        type="submit"
                        disabled={formLoading}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white h-12 rounded-xl font-semibold shadow-lg"
                        style={{ fontFamily: "'Poppins', sans-serif" }}
                      >
                        {formLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="w-5 h-5 mr-2" />
                            {editingAddress ? 'Update Address' : 'Save Address'}
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={resetForm}
                        variant="outline"
                        className="px-8 h-12 rounded-xl border-gray-300"
                        style={{ fontFamily: "'Poppins', sans-serif" }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Address List */}
          {!showForm && (
            <div className="space-y-3">
              {addresses.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl shadow-sm p-12 text-center"
                >
                  <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <MapPin className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>No addresses saved</h3>
                  <p className="text-xs text-gray-600" style={{ fontFamily: "'Poppins', sans-serif" }}>Add your first delivery address</p>
                </motion.div>
              ) : (
                addresses.map((address, index) => (
                  <motion.div
                    key={address.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-xl shadow-sm p-4 relative"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-8">
                        <h3 className="font-semibold text-gray-900 text-base mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          {address.fullName}
                        </h3>
                        <div className="space-y-0.5 text-gray-600 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          <p>{address.address}</p>
                          {address.locality && <p>{address.locality}</p>}
                          <p>{address.city}, {address.state} - {address.pinCode}</p>
                          <p className="pt-1">{address.phoneNumber}</p>
                        </div>
                        {address.isDefault && (
                          <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium" style={{ fontFamily: "'Poppins', sans-serif" }}>
                            ✓ Default
                          </span>
                        )}
                      </div>

                      {/* Three-dot Menu */}
                      <div className="relative menu-container">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === address.id ? null : address.id)}
                          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>

                        {/* Dropdown Menu */}
                        {openMenuId === address.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-40 z-10"
                          >
                            <button
                              onClick={() => {
                                handleEdit(address);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              style={{ fontFamily: "'Poppins', sans-serif" }}
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                handleDelete(address.id);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              style={{ fontFamily: "'Poppins', sans-serif" }}
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                            {!address.isDefault && (
                              <button
                                onClick={() => {
                                  handleSetDefault(address.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2 border-t border-gray-100"
                                style={{ fontFamily: "'Poppins', sans-serif" }}
                              >
                                <Check className="w-4 h-4" />
                                Set as Default
                              </button>
                            )}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <MobileBottomNav />
    </>
  );
};

export default SavedAddresses;
