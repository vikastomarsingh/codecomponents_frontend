import React, { useState, useEffect, createContext, useContext, useRef } from 'react';

// --- (A) API Context & Provider ---
// This context manages the user's authentication state (token, user details)
// and provides functions to interact with the backend API.
const ApiContext = createContext();

const ApiProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = 'https://code-compo-back.vercel.app'; // Your backend URL

  // Effect to load user from localStorage on initial load
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      // We have a token, let's verify it with the backend
      fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
        } else {
          localStorage.removeItem('token');
          setToken(null);
        }
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Function to fetch components
  const fetchComponents = () => {
    fetch(`${API_URL}/api/components`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setComponents(data))
    .catch(err => console.error('Failed to fetch components:', err));
  };
  
  // Fetch components when user logs in
  useEffect(() => {
    if (token) {
      fetchComponents();
    } else {
      setComponents([]); // Clear components on logout
    }
  }, [token]);
  
  // Helper to show API errors
  const handleError = (message) => {
    setError(message);
    setTimeout(() => setError(null), 3000); // Clear error after 3s
  };

  // --- API Functions ---

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.token && data.user) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      return true;
    } else {
      handleError(data.message || 'Login failed.');
      return false;
    }
  };

  const signup = async (name, email, mobile, password) => {
    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, mobile, password })
    });
    const data = await res.json();
    if (data.token && data.user) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      return true;
    } else {
      handleError(data.message || 'Signup failed.');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };
  
  // Seed database
  const seedDatabase = async () => {
    try {
      const res = await fetch(`${API_URL}/api/seed`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      alert(data.message);
      fetchComponents(); // Refresh component list
    } catch (err) {
      alert('Failed to seed database.');
    }
  };
  
  // Purchase Component (Razorpay Flow)
  const purchaseComponent = async (component) => {
    if (!component.price) return;
    
    // 1. Create an "order" on the backend
    const orderRes = await fetch(`${API_URL}/api/payment/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: component.price * 100, // Amount in paise
        currency: 'INR'
      })
    });
    const orderData = await orderRes.json();
    
    if (!orderData.id) {
      handleError('Could not create payment order.');
      return;
    }
    
    // 2. Configure and open Razorpay checkout
    const options = {
      key: orderData.razorpayKey, // Your Razorpay Key ID
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'CodeComponents Pro',
      description: `Purchase ${component.name}`,
      order_id: orderData.id,
      handler: async (response) => {
        // 3. Verify payment on the backend
        const verifyRes = await fetch(`${API_URL}/api/payment/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            componentId: component.id
          })
        });
        
        const verifyData = await verifyRes.json();
        
        if (verifyData.success && verifyData.user) {
          alert('Payment successful!');
          // Update user state with new component access
          setUser(verifyData.user);
        } else {
          handleError('Payment verification failed.');
        }
      },
      prefill: {
        name: user.name,
        email: user.email,
        contact: user.mobile
      },
      theme: {
        color: '#2563EB' // Blue theme
      }
    };
    
    // 4. Load Razorpay script and open modal
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const value = {
    user,
    token,
    components,
    login,
    signup,
    logout,
    seedDatabase,
    purchaseComponent,
    error,
    loading: loading
  };

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
};

// --- (B) Reusable UI Components ---

// PrettyButton: Our main button component
const PrettyButton = ({ variant = 'primary', onClick, children, className = '', ...props }) => {
  const baseStyle = 'px-6 py-2.5 font-medium text-sm rounded-lg shadow-lg transition-all duration-300 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900';
  const variants = {
    primary: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 focus:ring-blue-500 shadow-blue-500/30',
    secondary: 'bg-gray-700 text-gray-200 hover:bg-gray-600 focus:ring-gray-500 shadow-gray-700/30',
    ghost: 'bg-transparent text-gray-300 hover:text-white hover:bg-gray-800'
  };
  return (
    <button
      onClick={onClick}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// InfoCard: Used on the homepage
const InfoCard = ({ title, children }) => (
  <div className="bg-gray-800 shadow-xl rounded-2xl overflow-hidden">
    <div className="p-6">
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-gray-400">{children}</p>
    </div>
  </div>
);

// ProModal: Shown on component page
const ProModal = ({ onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-gray-800 rounded-lg shadow-2xl p-8 max-w-sm w-full m-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Pro Component</h3>
        <p className="text-gray-400 mb-6">This component is available for Pro users. Purchase to unlock!</p>
        <PrettyButton variant="primary" onClick={onClose}>Got it</PrettyButton>
      </div>
    </div>
  </div>
);

// Generic Modal (used for Login/Signup forms)
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- (C) App Components (from library) ---
// These are the actual component implementations for the demos.

const LibraryPrettyButton = ({ variant = 'primary', children }) => {
  const baseStyle = 'px-5 py-2 font-medium rounded-lg shadow-md transition-all duration-300';
  const variants = {
    primary: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
  };
  return <button className={`${baseStyle} ${variants[variant]}`}>{children}</button>;
};

const LibraryInfoCard = () => (
  <div className="max-w-xs bg-white rounded-lg shadow-lg p-6">
    <h3 className="text-lg font-bold text-gray-900 mb-2">Info Card</h3>
    <p className="text-gray-600">This is a sample info card component for your library.</p>
  </div>
);

const LibrarySpinner = () => (
  <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
);

const LibraryProBadge = () => (
  <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
    PRO
  </span>
);

const LibraryAnimatedToggle = () => {
  const [isOn, setIsOn] = useState(false);
  return (
    <label htmlFor="demo-toggle" className="flex items-center cursor-pointer">
      <div className="relative">
        <input 
          id="demo-toggle" 
          type="checkbox" 
          className="sr-only" 
          checked={isOn}
          onChange={() => setIsOn(!isOn)} 
        />
        <div className="block bg-gray-600 w-14 h-8 rounded-full transition-colors"></div>
        <div 
          className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ease-in-out ${isOn ? 'translate-x-6' : ''}`}
        ></div>
      </div>
      <div className={`ml-3 font-medium ${isOn ? 'text-blue-300' : 'text-gray-400'}`}>
        {isOn ? 'Enabled' : 'Disabled'}
      </div>
    </label>
  );
};

const LibraryGradientCard = ({ children }) => {
  // This component uses a CSS animation defined in the main <style> tag
  return (
    <div className="relative p-1 max-w-sm w-full rounded-lg overflow-hidden
                    bg-gradient-to-r from-purple-400 via-pink-500 to-red-500
                    animate-gradient-pulse"
         style={{ backgroundSize: '200% 200%' }}
    >
      <div className="bg-gray-800 p-6 rounded-lg h-full">
        {children}
      </div>
    </div>
  );
};

const LibraryAvatarGroup = () => (
  <div className="flex -space-x-4">
    <img className="w-12 h-12 rounded-full border-4 border-gray-800 object-cover" src="https://placehold.co/100x100/6366F1/FFFFFF?text=A" alt="User A" />
    <img className="w-12 h-12 rounded-full border-4 border-gray-800 object-cover" src="https://placehold.co/100x100/EC4899/FFFFFF?text=B" alt="User B" />
    <img className="w-12 h-12 rounded-full border-4 border-gray-800 object-cover" src="https://placehold.co/100x100/22D3EE/FFFFFF?text=C" alt="User C" />
    <div className="w-12 h-12 rounded-full border-4 border-gray-800 bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-300">
      +5
    </div>
  </div>
);

const LibraryMetricCard = () => (
  <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-xs w-full">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-gray-400">Total Revenue</p>
      <span className="text-green-400">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
      </span>
    </div>
    <p className="text-3xl font-bold text-white mt-2">$45,231.89</p>
    <p className="text-sm text-gray-400 mt-1">+20.1% from last month</p>
  </div>
);

const LibraryStepProgress = () => {
  const [currentStep, setCurrentStep] = useState(2);
  const steps = ['Details', 'Address', 'Payment', 'Confirm'];
  
  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const stepIndex = index + 1;
          const isActive = stepIndex <= currentStep;
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                    ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                >
                  {stepIndex}
                </div>
                <p className={`mt-2 text-sm font-medium ${isActive ? 'text-white' : 'text-gray-500'}`}>{step}</p>
              </div>
              {stepIndex < steps.length && (
                <div 
                  className={`flex-1 h-1 mx-2 transition-all duration-300
                    ${isActive ? 'bg-blue-600' : 'bg-gray-700'}`}
                ></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="text-center mt-6">
        <PrettyButton 
          variant="secondary" 
          onClick={() => setCurrentStep(s => Math.max(1, s - 1))}
          disabled={currentStep === 1}
          className="disabled:opacity-50"
        >
          Previous
        </PrettyButton>
        <PrettyButton 
          variant="primary" 
          className="ml-4 disabled:opacity-50"
          onClick={() => setCurrentStep(s => Math.min(steps.length, s + 1))}
          disabled={currentStep === steps.length}
        >
          Next
        </PrettyButton>
      </div>
    </div>
  );
};

const LibraryAnimatedTabs = () => {
  const [activeTab, setActiveTab] = useState('details');
  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'shipping', label: 'Shipping' },
  ];
  
  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
  
  return (
    <div className="w-full max-w-md bg-gray-800 p-2 rounded-lg">
      <div className="relative flex p-1 bg-gray-900 rounded-md">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative z-10 flex-1 py-2 text-center text-sm font-medium rounded-md transition-colors
              ${activeTab === tab.id ? 'text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
        <div 
          className="absolute top-1 left-1 bottom-1 w-1/3 bg-blue-600 rounded-md shadow-lg transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        ></div>
      </div>
      <div className="p-4 mt-2 min-h-[50px]">
        <p className="text-white">Content for <span className="font-medium capitalize">{activeTab}</span></p>
      </div>
    </div>
  );
};

const LibraryBentoGrid = () => (
  <div className="grid grid-cols-3 grid-rows-2 gap-4 w-full max-w-2xl h-72">
    <div className="col-span-2 row-span-1 bg-gray-800 rounded-lg p-4 flex flex-col justify-between">
      <h3 className="text-lg font-semibold text-white">Main Feature</h3>
      <p className="text-sm text-gray-400">This is the primary cell in the grid.</p>
    </div>
    <div className="col-span-1 row-span-2 bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white">Sidebar</h3>
      <p className="text-sm text-gray-400 mt-2">A taller cell for vertical content.</p>
    </div>
    <div className="col-span-1 row-span-1 bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white">Metric 1</h3>
    </div>
    <div className="col-span-1 row-span-1 bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white">Metric 2</h3>
    </div>
  </div>
);

// --- NEWLY ADDED COMPONENTS ---

const LibraryBreadcrumbs = () => {
  const BreadcrumbItem = ({ href, children, isCurrent }) => (
    <li className="flex items-center">
      <a 
        href={href || '#'} 
        className={`${isCurrent ? 'text-gray-400' : 'text-blue-400 hover:text-blue-300'} transition-colors text-sm`}
        aria-current={isCurrent ? 'page' : undefined}
        onClick={(e) => e.preventDefault()}
      >
        {children}
      </a>
      {!isCurrent && (
        <svg className="w-5 h-5 text-gray-500 mx-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </li>
  );

  const items = [
    { label: 'Home', href: '#' },
    { label: 'Components', href: '#' },
    { label: 'Breadcrumbs', href: '#', isCurrent: true },
  ];

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center">
        {items.map((item, index) => (
          <BreadcrumbItem key={index} href={item.href} isCurrent={item.isCurrent}>
            {item.label}
          </BreadcrumbItem>
        ))}
      </ol>
    </nav>
  );
};

const LibraryTooltip = () => {
  const Tooltip = ({ children, text }) => (
    <div className="relative inline-flex group">
      {children}
      <div 
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 
                   bg-gray-900 text-white text-sm rounded-md 
                   opacity-0 group-hover:opacity-100 transition-opacity duration-300 
                   pointer-events-none whitespace-nowrap z-10"
      >
        {text}
        <div 
          className="absolute left-1/2 -translate-x-1/2 top-full 
                     w-0 h-0 border-x-4 border-x-transparent 
                     border-t-4 border-t-gray-900"
        ></div>
      </div>
    </div>
  );

  return (
    <Tooltip text="This is a tooltip!">
      <button className="bg-blue-500 text-white px-4 py-2 rounded-lg">
        Hover me
      </button>
    </Tooltip>
  );
};

const LibraryAccordion = () => {
  const AccordionItem = ({ title, children, isOpen, onClick }) => {
    return (
      <div className="border-b border-gray-700 last:border-b-0">
        <h2>
          <button
            type="button"
            className="flex items-center justify-between w-full p-5 font-medium text-left text-gray-300 hover:bg-gray-700 transition-colors"
            onClick={onClick}
            aria-expanded={isOpen}
          >
            <span>{title}</span>
            <svg
              className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </h2>
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96' : 'max-h-0'}`}
        >
          <div className="p-5 border-t border-gray-700 bg-gray-900">
            <p className="text-gray-400">{children}</p>
          </div>
        </div>
      </div>
    );
  };

  const [openIndex, setOpenIndex] = useState(0); // 0 = first item open

  const items = [
    { title: "What is CodeComponents?", content: "CodeComponents is a library of copy-paste React components to help you build UIs faster." },
    { title: "How do I use a Pro component?", content: "Once purchased, you get access to the component's code, which you can copy and paste into your project." },
    { title: "Can I get a refund?", content: "We offer a 7-day money-back guarantee if you are not satisfied with the Pro components." },
  ];

  return (
    <div className="w-full max-w-md bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {items.map((item, index) => (
        <AccordionItem 
          key={index} 
          title={item.title} 
          isOpen={openIndex === index}
          onClick={() => setOpenIndex(openIndex === index ? -1 : index)} // -1 = all closed
        >
          {item.content}
        </AccordionItem>
      ))}
    </div>
  );
};

const LibraryDataTable = () => {
  const users = [
    { id: 1, name: 'Jane Cooper', title: 'Regional Paradigm Technician', role: 'Admin', email: 'jane.cooper@example.com' },
    { id: 2, name: 'Cody Fisher', title: 'Product Directives Officer', role: 'Owner', email: 'cody.fisher@example.com' },
    { id: 3, name: 'Esther Howard', title: 'Forward Response Developer', role: 'Member', email: 'esther.howard@example.com' },
    { id: 4, name: 'Jenny Wilson', title: 'Central Security Manager', role: 'Member', email: 'jenny.wilson@example.com' },
  ];

  return (
    <div className="w-full max-w-4xl bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-gray-800">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Title</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Edit</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-gray-900 divide-y divide-gray-700">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-800 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="text-sm font-medium text-white">{user.name}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-400">{user.title}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span 
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${user.role === 'Admin' ? 'bg-red-900 text-red-300' : 
                      user.role === 'Owner' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}`}
                >
                  {user.role}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <a href="#" className="text-blue-400 hover:text-blue-300" onClick={(e) => e.preventDefault()}>Edit</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const LibraryKanbanBoard = () => {
  const KanbanCard = ({ title, tags }) => (
    <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 shadow-lg mb-4">
      <h4 className="font-medium text-white mb-2">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <span 
            key={tag.name} 
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${tag.color}`}
          >
            {tag.name}
          </span>
        ))}
      </div>
    </div>
  );

  const KanbanColumn = ({ title, children }) => (
    <div className="flex-1 bg-gray-800 rounded-lg p-4 min-w-[300px]">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div>
        {children}
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-6xl p-4 bg-gray-800 rounded-lg overflow-x-auto">
      <div className="flex space-x-4">
        <KanbanColumn title="Backlog">
          <KanbanCard title="Design new homepage" tags={[{name: 'UI/UX', color: 'bg-pink-800 text-pink-300'}]} />
          <KanbanCard title="Setup CI/CD pipeline" tags={[{name: 'DevOps', color: 'bg-gray-700 text-gray-300'}]} />
        </KanbanColumn>
        <KanbanColumn title="In Progress">
          <KanbanCard title="Develop auth API" tags={[{name: 'Backend', color: 'bg-blue-800 text-blue-300'}]} />
          <KanbanCard title="Create component library" tags={[{name: 'Frontend', color: 'bg-purple-800 text-purple-300'}]} />
        </KanbanColumn>
        <KanbanColumn title="Review">
          <KanbanCard title="Implement payment gateway" tags={[{name: 'Backend', color: 'bg-blue-800 text-blue-300'}, {name: 'High Priority', color: 'bg-red-800 text-red-300'}]} />
        </KanbanColumn>
        <KanbanColumn title="Done">
          <KanbanCard title="Initial project setup" tags={[{name: 'DevOps', color: 'bg-gray-700 text-gray-300'}]} />
        </KanbanColumn>
      </div>
    </div>
  );
};

const LibraryMagicLineNavbar = () => {
  // --- State for the magic line ---
  const [hoveredRect, setHoveredRect] = useState(null);
  const [navRect, setNavRect] = useState(null);

  // --- Data for the links ---
  const navLinks = [
    { id: 1, text: 'Home', href: '#' },
    { id: 2, text: 'Features', href: '#' },
    { id: 3, text: 'Pricing', href: '#' },
    { id: 4, text: 'About Us', href: '#' },
  ];

  // --- Nested component for each nav item ---
  const NavItem = ({ href, onMouseEnter, children }) => (
    <a
      href={href}
      className="relative px-5 py-2 text-gray-300 font-medium z-10 hover:text-white transition-colors"
      onMouseEnter={onMouseEnter} // The parent's handler is passed as a prop
      onClick={(e) => e.preventDefault()} // Added to match your example's behavior
    >
      {children}
    </a>
  );

  // --- Handlers in the parent component ---
  const handleMouseLeave = () => {
    setHoveredRect(null);
  };

  const handleMouseEnter = (e) => {
    // Get the bounding box of the hovered link
    setHoveredRect(e.currentTarget.getBoundingClientRect());
  };
  
  // Calculate position and width of the magic line
  const magicLineStyle = {
    width: hoveredRect ? `${hoveredRect.width}px` : '0px',
    transform: hoveredRect && navRect 
      ? `translateX(${hoveredRect.left - navRect.left}px)` 
      : 'translateX(0px)',
    opacity: hoveredRect ? 1 : 0,
    transition: 'transform 0.3s ease-in-out, width 0.3s ease-in-out, opacity 0.2s',
  };

  return (
    <div className="flex justify-center items-center p-4 bg-gray-950">
      <nav 
        className="relative flex items-center p-4 bg-gray-900 rounded-lg shadow-lg"
        onMouseLeave={handleMouseLeave}
        // We get the nav's bounding box once when the mouse first enters
        onMouseEnter={(e) => {
          if (!navRect) {
            setNavRect(e.currentTarget.getBoundingClientRect());
          }
        }}
      >
        {/* The Magic Line */}
        <span
          className="absolute bottom-2 left-0 h-1 bg-cyan-400 rounded-full"
          style={magicLineStyle}
        />

        {/* Map over the data and render the nested component */}
        {navLinks.map((link) => (
          <NavItem
            key={link.id}
            href={link.href}
            onMouseEnter={handleMouseEnter}
          >
            {link.text}
          </NavItem>
        ))}
      </nav>
    </div>
  );
};

// ----- NEWLY ADDED COMPONENTS END HERE -----


// This object maps component IDs to their render functions for demos
const componentRenderers = {
  'pretty-button': () => (
    <div className="flex flex-wrap gap-4">
      <LibraryPrettyButton variant="primary">Primary</LibraryPrettyButton>
      <LibraryPrettyButton variant="secondary">Secondary</LibraryPrettyButton>
    </div>
  ),
  'info-card': () => <LibraryInfoCard />,
  'pro-modal': () => <p className="text-gray-400">Click the "Purchase" button to see the payment flow.</p>,
  'spinner': () => <LibrarySpinner />,
  'pro-badge': () => (
    <div className="flex items-center gap-3">
      <span className="text-lg text-white">Premium Feature</span>
      <LibraryProBadge />
    </div>
  ),
  'animated-toggle': () => <LibraryAnimatedToggle />,
  'gradient-card': () => (
    <LibraryGradientCard>
      <h3 className="text-xl font-bold text-white">Pro Component</h3>
      <p className="text-gray-400 mt-2">This card really stands out!</p>
    </LibraryGradientCard>
  ),
  'avatar-group': () => <LibraryAvatarGroup />,
  'metric-card': () => <LibraryMetricCard />,
  'step-progress': () => <LibraryStepProgress />,
  'animated-tabs': () => <LibraryAnimatedTabs />,
  'bento-grid': () => <LibraryBentoGrid />,
  
  // --- NEW RENDERERS ---
  'breadcrumbs': () => <LibraryBreadcrumbs />,
  'tooltip': () => <LibraryTooltip />,
  'accordion': () => <LibraryAccordion />,
  'data-table': () => <LibraryDataTable />,
  'kanban-board': () => <LibraryKanbanBoard />,
  'magic-line-navbar': () => <LibraryMagicLineNavbar />
};

// Loading spinner (for the app itself, not the library)
const Spinner = () => (
  <div className="w-16 h-16 border-8 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
);

// --- (D) Helper SVGs for UI ---

const IconLayers = ({ className = '' }) => (
  <div className={`w-12 h-12 flex items-center justify-center bg-blue-900 rounded-full text-blue-400 transition-all duration-300 transform group-hover:scale-110 group-hover:rotate-6 ${className}`}>
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
    </svg>
  </div>
);

const IconZap = ({ className = '' }) => (
  <div className={`w-12 h-12 flex items-center justify-center bg-blue-900 rounded-full text-blue-400 transition-all duration-300 transform group-hover:scale-110 group-hover:rotate-6 ${className}`}>
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  </div>
);

const IconCode = ({ className = '' }) => (
  <div className={`w-12 h-12 flex items-center justify-center bg-blue-900 rounded-full text-blue-400 transition-all duration-300 transform group-hover:scale-110 group-hover:rotate-6 ${className}`}>
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  </div>
);

// --- (E) Page Components ---

const Navbar = ({ onNavigate }) => {
  const { user, logout } = useContext(ApiContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-gray-900 bg-opacity-70 backdrop-blur-lg border-b border-gray-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          <div className="flex items-center">
            <span 
              onClick={() => {
                onNavigate('home');
                setIsMobileMenuOpen(false);
              }} 
              className="font-bold text-2xl text-blue-400 cursor-pointer"
            >
              CodeComponents
            </span>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">
            <span 
              onClick={() => onNavigate('home')} 
              className="text-gray-400 hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors"
            >
              Home
            </span>
            <span 
              onClick={() => onNavigate('components')} 
              className="text-gray-400 hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors"
            >
              Components
            </span>
            
            <div className="w-px h-6 bg-gray-700"></div>
            
            {user ? (
              <>
                <span className="text-gray-400 text-sm">Hi, {user.name.split(' ')[0]}</span>
                <PrettyButton variant="secondary" onClick={() => {
                  logout();
                  onNavigate('home');
                }}>
                  Logout
                </PrettyButton>
              </>
            ) : (
              <PrettyButton variant="primary" onClick={() => onNavigate('login')}>
                Login
              </PrettyButton>
            )}
          </div>
          
          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-400 hover:text-white p-2 rounded-md focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                )}
              </svg>
            </button>
          </div>
          
        </div>
      </div>
      
      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-gray-900 bg-opacity-90 border-t border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <span 
              onClick={() => { onNavigate('home'); setIsMobileMenuOpen(false); }} 
              className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium cursor-pointer"
            >
              Home
            </span>
            <span 
              onClick={() => { onNavigate('components'); setIsMobileMenuOpen(false); }} 
              className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium cursor-pointer"
            >
              Components
            </span>
          </div>
          <div className="pt-4 pb-3 border-t border-gray-700">
            {user ? (
              <div className="px-5">
                <span className="block text-gray-400 text-base font-medium">Hi, {user.name}</span>
                <PrettyButton 
                  variant="secondary" 
                  onClick={() => {
                    logout();
                    onNavigate('home');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full mt-3"
                >
                  Logout
                </PrettyButton>
              </div>
            ) : (
              <div className="px-5">
                <PrettyButton 
                  variant="primary" 
                  onClick={() => { onNavigate('login'); setIsMobileMenuOpen(false); }}
                  className="w-full"
                >
                  Login
                </PrettyButton>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

const Footer = ({ onNavigate }) => {
  // Social media icon paths
  const socialIcons = [
    { name: 'GitHub', path: 'M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 00-1.3-3.2 4.2 4.2 0 00-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 00-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1s-.2 1.2-.1 3.2A4.6 4.6 0 004 9.5c0 4.6 2.7 5.7 5.5 6-.6.5-.5 1.4-.5 2V21' },
    { name: 'Twitter', path: 'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z' },
    { name: 'Dribbble', path: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.2 15.1c-2.3.1-4.2-1.6-4.2-3.9 0-2.3 1.9-4.2 4.2-4.2 2.3 0 4.2 1.9 4.2 4.2 0 2.3-1.9 3.9-4.2 3.9zm.1-6.4c-1.2 0-2.2 1-2.2 2.2s1 2.2 2.2 2.2 2.2-1 2.2-2.2-1-2.2-2.2-2.2zM12 4.1c1.6 0 3.1.5 4.3 1.4A4.2 4.2 0 0013 7.8c-1.2 0-2.2 1-2.2 2.2 0 .4.1.8.3 1.1A7 7 0 015.5 7.6C6.6 5.5 9.1 4.1 12 4.1z' }
  ];

  return (
    <footer className="bg-gray-800 border-t border-gray-700">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          
          <div>
            <span className="font-bold text-2xl text-blue-400">CodeComponents</span>
            <p className="mt-2 text-gray-400 text-sm max-w-md">
              A UI library for modern developers. Built with React, Tailwind, and Express.
            </p>
            <p className="mt-4 text-sm font-bold text-blue-300">
              Powered by Coder's Prangan
            </p>
          </div>
          
          <div className="flex gap-6 justify-start md:justify-end">
            {socialIcons.map(icon => (
              <a key={icon.name} href="#" className="text-gray-500 hover:text-blue-400 transition-all transform hover:scale-125">
                <span className="sr-only">{icon.name}</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon.path} />
                </svg>
              </a>
            ))}
          </div>
          
        </div>
      </div>
    </footer>
  );
};

// Hook for scroll animations
const useIntersectionObserver = (options) => {
  const [ref, setRef] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, options);

    if (ref) {
      observer.observe(ref);
    }

    return () => {
      if (ref) {
        observer.unobserve(ref);
      }
    };
  }, [ref, options]);

  return [setRef, isVisible];
};


// Galaxy Background
const GalaxyBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let stars = [];
    const numStars = 200;

    const resizeHandler = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', resizeHandler);

    function Star() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.z = Math.random() * width;
      this.o = Math.random() * 1 + 0.2; // Opacity

      this.move = () => {
        this.z -= 0.5;
        if (this.z <= 0) {
          this.z = width;
        }
      };

      this.show = () => {
        if (!ctx) return;
        let x = (this.x - width / 2) * (width / this.z) + width / 2;
        let y = (this.y - height / 2) * (width / this.z) + height / 2;
        let r = (width / this.z) * 0.5; // Radius
        
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${this.o})`;
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      };
    }

    for (let i = 0; i < numStars; i++) {
      stars.push(new Star());
    }

    let animationFrameId;
    function draw() {
      if (ctx) {
        ctx.fillStyle = '#0f172a'; // Dark blue-gray
        ctx.fillRect(0, 0, width, height);
        for (let star of stars) {
          star.move();
          star.show();
        }
      }
      animationFrameId = requestAnimationFrame(draw);
    }
    
    draw();

    return () => {
      window.removeEventListener('resize', resizeHandler);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-0" />;
};


const HomePage = ({ onNavigate }) => {
  const [showModal, setShowModal] = useState(false);
  
  // Refs for scroll animations
  const [liveDemosRef, isLiveDemosVisible] = useIntersectionObserver({ threshold: 0.1 });
  const [featuresRef, isFeaturesVisible] = useIntersectionObserver({ threshold: 0.1 });
  const [ctaRef, isCtaVisible] = useIntersectionObserver({ threshold: 0.1 });

  return (
    <div className="w-full">
      {/* Hero Section */}
      <div className="relative w-full h-screen flex items-center justify-center text-center overflow-hidden -mt-16 pt-16"> {/* Offset for navbar */}
        <GalaxyBackground />
        
        {/* Floating Components */}
        <div className="absolute z-10 top-0 left-0 w-full h-full overflow-hidden hidden md:block">
          {/* Floating Mini Button */}
          <div 
            className="absolute px-4 py-2 font-medium text-sm rounded-lg shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white animate-float"
            style={{ top: '15%', left: '10%', animationDuration: '8s' }}
          >
            Click Me
          </div>
          
          {/* Floating Mini Card */}
          <div 
            className="absolute p-3 bg-gray-800 rounded-lg shadow-xl w-36 animate-float"
            style={{ top: '60%', left: '20%', animationDuration: '10s', animationDelay: '2s' }}
          >
            <div className="h-2 bg-gray-600 rounded w-3/4 mb-2"></div>
            <div className="h-2 bg-gray-700 rounded w-full"></div>
            <div className="h-2 bg-gray-700 rounded w-1/2 mt-1"></div>
          </div>
          
          {/* Floating Mini Badge */}
          <div 
            className="absolute px-2 py-0.5 rounded-full text-xs font-medium bg-purple-600 text-white animate-float"
            style={{ top: '20%', left: '80%', animationDuration: '9s', animationDelay: '1s' }}
          >
            PRO
          </div>
        </div>

        <div className="relative z-20 flex flex-col items-center p-4"> {/* Increased z-index */}
          <h1 className="text-5xl md:text-7xl font-extrabold text-white animate-fade-in-down" style={{ animationDelay: '0.2s' }}>
            Build <span className="animated-gradient-text">Beautiful</span> UIs
          </h1>
          <p className="mt-6 text-xl md:text-2xl text-gray-300 max-w-3xl animate-fade-in-down" style={{ animationDelay: '0.4s' }}>
            Professionally designed, copy-paste React components to build your next project faster.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-6 animate-fade-in-down" style={{ animationDelay: '0.6s' }}>
            <PrettyButton 
              variant="primary" 
              className="animate-shimmer text-lg px-8 py-3" 
              onClick={() => onNavigate('components')}
            >
              Get Started
            </PrettyButton>
            <PrettyButton 
              variant="secondary" 
              className="text-lg px-8 py-3"
              onClick={() => onNavigate('components')}
            >
              Browse Library
            </PrettyButton>
          </div>
        </div>
      </div>

      {/* Live Demos */}
      <div 
        ref={liveDemosRef} 
        className={`relative bg-gray-900 py-16 transition-all duration-700 ease-out overflow-hidden ${isLiveDemosVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        style={{ perspective: '1000px' }}
      >
        <div className="dot-pattern"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <h2 className="text-3xl font-extrabold text-white text-center mb-12">Live Demos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Card 1 */}
            <div className="group flex flex-col items-center p-6 bg-gray-800 bg-opacity-80 backdrop-blur-sm rounded-lg shadow-lg h-full transition-all duration-300 transform hover:-translate-y-2 hover:shadow-blue-500/20 hover:shadow-2xl">
              <h3 className="text-2xl font-bold text-white mb-6">Metric Card</h3>
              {componentRenderers['metric-card']()}
            </div>
            {/* Card 2 */}
            <div className="group flex flex-col items-center p-6 bg-gray-800 bg-opacity-80 backdrop-blur-sm rounded-lg shadow-lg h-full transition-all duration-300 transform hover:-translate-y-2 hover:shadow-blue-500/20 hover:shadow-2xl">
              <h3 className="text-2xl font-bold text-white mb-6">Breadcrumbs</h3>
              {componentRenderers['breadcrumbs']()}
            </div>
            {/* Card 3 */}
            <div className="group flex flex-col items-center p-6 bg-gray-800 bg-opacity-80 backdrop-blur-sm rounded-lg shadow-lg h-full transition-all duration-300 transform hover:-translate-y-2 hover:shadow-blue-500/20 hover:shadow-2xl">
              <h3 className="text-2xl font-bold text-white mb-6">Animated Toggle</h3>
              {componentRenderers['animated-toggle']()}
            </div>
          </div>
        </div>
        {showModal && <ProModal onClose={() => setShowModal(false)} />}
      </div>

      {/* Features Section */}
      <div 
        ref={featuresRef}
        className="relative bg-gray-800 py-24 overflow-hidden"
      >
        <div className="dot-pattern"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div 
            className={`text-center transition-all duration-700 ease-out ${isFeaturesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            <h2 className="text-base font-semibold text-blue-400 tracking-wide uppercase">Why Us?</h2>
            <p className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
              Everything you need. Nothing you don't.
            </p>
          </div>
          <div 
            className={`mt-20 grid grid-cols-1 md:grid-cols-3 gap-12 transition-all duration-700 ease-out delay-200 ${isFeaturesVisible ? 'opacity-100' : 'opacity-0'}`}
            style={{ transitionProperty: 'opacity' }}
          >
            {/* Feature 1 */}
            <div className="text-center p-4 group">
              <IconZap className="mx-auto" />
              <h3 className="mt-6 text-xl font-semibold text-white">Blazing Fast</h3>
              <p className="mt-2 text-gray-400">
                Stop reinventing the wheel. Grab production-ready components and build your app in record time.
              </p>
            </div>
            {/* Feature 2 */}
            <div className="text-center p-4 group">
              <IconCode className="mx-auto" />
              <h3 className="mt-6 text-xl font-semibold text-white">Developer Friendly</h3>
              <p className="mt-2 text-gray-400">
                Clean code built with Tailwind CSS. Copy, paste, and customize. It's that simple.
              </p>
            </div>
            {/* Feature 3 */}
            <div className="text-center p-4 group">
              <IconLayers className="mx-auto" />
              <h3 className="mt-6 text-xl font-semibold text-white">Production Ready</h3>
              <p className="mt-2 text-gray-400">
                Fully accessible, responsive, and tested components, ready for your professional projects.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div 
        ref={ctaRef}
        className="bg-gray-900"
      >
        <div 
          className={`max-w-4xl mx-auto py-16 px-4 sm:px-6 lg:px-8 text-center transition-all duration-1000 ease-out ${isCtaVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        >
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            <span className="block">Ready to dive in?</span>
            <span className="block animated-gradient-text">Start building today.</span>
          </h2>
          <p className="mt-4 text-lg leading-6 text-blue-100">
            Create an account to access free components, or purchase a Pro license to unlock everything.
          </p>
          <PrettyButton
            variant="primary"
            className="mt-8 text-lg px-8 py-3 animate-shimmer"
            onClick={() => onNavigate('components')}
          >
            Browse Components
          </PrettyButton>
        </div>
      </div>
    </div>
  );
};

const LoginPage = ({ onNavigate }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const { login, signup, error } = useContext(ApiContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    let success = false;
    if (isLogin) {
      success = await login(email, password);
    } else {
      success = await signup(name, email, mobile, password);
    }
    if (success) {
      onNavigate('components'); // Navigate to components on successful login/signup
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="max-w-md w-full">
        <Modal isOpen={true} onClose={() => onNavigate('home')} title={isLogin ? 'Welcome Back' : 'Create Account'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {error && <p className="text-red-400 bg-red-900 bg-opacity-30 p-3 rounded-lg text-center">{error}</p>}
            
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required 
                    className="w-full px-4 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Mobile Number</label>
                  <input 
                    type="tel" 
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required 
                    className="w-full px-4 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                className="w-full px-4 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                className="w-full px-4 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <PrettyButton variant="primary" type="submit" className="w-full">
              {isLogin ? 'Login' : 'Create Account'}
            </PrettyButton>
            
            <p className="text-sm text-center text-gray-400">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
              <span 
                onClick={() => setIsLogin(!isLogin)}
                className="font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                {isLogin ? 'Sign Up' : 'Login'}
              </span>
            </p>
          </form>
        </Modal>
      </div>
    </div>
  );
};


const ComponentsPage = ({ onNavigate }) => {
  const { user, components, purchaseComponent, seedDatabase, token } = useContext(ApiContext);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [view, setView] = useState('demo'); // 'demo' or 'code'
  const [copyStatus, setCopyStatus] = useState('Copy');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  useEffect(() => {
    if (!user) {
      onNavigate('login');
    }
  }, [user, onNavigate]);

  useEffect(() => {
    if (components.length > 0 && !selectedComponent) {
      setSelectedComponent(components[0]);
    }
  }, [components, selectedComponent]);

  const userHasAccess = (component) => {
    if (!component?.price || component.price === 0) return true; // Add null check for component
    return user?.purchasedComponents?.includes(component.id);
  };
  
  const handlePurchase = (component) => {
    purchaseComponent(component);
  };

  const handleCopyCode = () => {
    if (!selectedComponent?.code) return;
    
    // Use document.execCommand as fallback for navigator.clipboard
    try {
      const ta = document.createElement('textarea');
      ta.value = selectedComponent.code;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);

      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus('Copy'), 2000);
    } catch (err) {
      console.error('Failed to copy code', err);
      setCopyStatus('Error');
      setTimeout(() => setCopyStatus('Copy'), 2000);
    }
  };

  const renderer = selectedComponent ? componentRenderers[selectedComponent.id] : null;

  if (!user) return null; // Should be redirected by effect

  return (
    <div className="relative flex flex-col md:flex-row min-h-[calc(100vh-10.7rem)]"> {/* Adjusted height for footer */}
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* --- SIDEBAR --- */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 border-r border-gray-700 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:w-1/4 md:inset-y-auto md:h-[calc(100vh-10.7rem)] flex flex-col`}
      >
        <h2 className="text-xl font-bold text-white p-6 flex-shrink-0">Components</h2>
        
        {/* Scrollable component list */}
        <nav className="flex-grow overflow-y-auto px-6 space-y-2 [&::-webkit-scrollbar]:hidden scrollbar-width-none">
          {components.map(comp => (
            <div 
              key={comp.id}
              onClick={() => {
                setSelectedComponent(comp);
                setIsSidebarOpen(false); // Close sidebar on mobile after selection
              }}
              className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-all ${selectedComponent?.id === comp.id ? 'bg-blue-900 text-blue-300 font-medium' : 'text-gray-400 hover:bg-gray-700'}`}
            >
              <span>{comp.name}</span>
              {comp.price > 0 && (
                <LibraryProBadge />
              )}
            </div>
          ))}
        </nav>
        
        {/* Seed Database Button (for testing) */}
        {token && (
          <div className="flex-shrink-0 p-6 mt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-2">Dev Tool:</p>
            <PrettyButton variant="secondary" onClick={seedDatabase} className="w-full">
              Seed Database
            </PrettyButton>
          </div>
        )}
      </div>
      
      {/* Main Content */}
      <div className="w-full md:w-3/4 flex flex-col">
        {selectedComponent ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-700 bg-gray-900">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <button 
                    className="p-1 text-gray-400 hover:text-white md:hidden"
                    onClick={() => setIsSidebarOpen(true)}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                  </button>
                  <h1 className="text-3xl font-bold text-white">{selectedComponent.name}</h1>
                </div>
                {!userHasAccess(selectedComponent) ? (
                  <PrettyButton variant="primary" onClick={() => handlePurchase(selectedComponent)}>
                    Buy for ₹{selectedComponent.price}
                  </PrettyButton>
                ) : (
                  <span className="text-green-400 font-medium text-sm hidden sm:block">ACCESS GRANTED</span>
                )}
              </div>
              <p className="text-gray-400 mt-2 md:mt-0">{selectedComponent.description}</p>
            </div>
            
            {/* Viewport */}
            <div className="flex-1 bg-gray-950 p-4 sm:p-8 overflow-y-auto">
              <div className="mb-6">
                <div className="flex border-b border-gray-700">
                  <button 
                    onClick={() => setView('demo')}
                    className={`py-2 px-4 ${view === 'demo' ? 'border-b-2 border-blue-400 text-blue-300' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Demo
                  </button>
                  <button 
                    onClick={() => setView('code')}
                    className={`py-2 px-4 ${view === 'code' ? 'border-b-2 border-blue-400 text-blue-300' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Code
                  </button>
                </div>
              </div>
              
              {view === 'demo' && (
                <div className="bg-gray-800 p-4 sm:p-8 rounded-lg shadow-inner border border-gray-700 min-h-[300px] flex items-center justify-center">
                  {renderer ? renderer() : <p>No demo available.</p>}
                </div>
              )}
              
              {view === 'code' && (
                <div>
                  {userHasAccess(selectedComponent) ? (
                    <div className="relative">
                      <PrettyButton 
                        variant="secondary"
                        onClick={handleCopyCode}
                        className="absolute top-4 right-4 z-10"
                      >
                        {copyStatus}
                      </PrettyButton>
                      <pre className="bg-gray-900 text-white p-6 rounded-lg overflow-x-auto">
                        <code>{selectedComponent.code}</code>
                      </pre>
                    </div>
                  ) : (
                    <div className="text-center p-10 bg-gray-800 rounded-lg shadow-inner">
                      <h3 className="text-2xl font-bold text-white mb-4">Get Access</h3>
                      <p className="text-gray-400 mb-6">This component is for Pro members. Purchase it to get access to the code.</p>
                      <PrettyButton variant="primary" onClick={() => handlePurchase(selectedComponent)}>
                        Buy for ₹{selectedComponent.price}
                      </PrettyButton>
                    </div>
                  )}
                </div>
              )}
              
            </div>
          </>
        ) : (
          <div className="flex-1 bg-gray-950 p-8 flex items-center justify-center">
            {/* Mobile Hamburger for when no component is selected */}
            <button 
              className="absolute top-6 left-6 p-1 text-gray-400 hover:text-white md:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
            </button>
            <p className="text-gray-500 text-xl text-center">Select a component to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};


// --- (G) Main App Component ---

// Main router
const AppContent = () => {
  const [page, setPage] = useState('home'); // 'home', 'components', 'login'
  const { loading } = useContext(ApiContext);

  const onNavigate = (targetPage) => {
    setPage(targetPage);
  };
  
  // This is a simple router
  const renderPage = () => {
    switch(page) {
      case 'home':
        return <HomePage onNavigate={onNavigate} />;
      case 'components':
        return <ComponentsPage onNavigate={onNavigate} />;
      case 'login':
        return <LoginPage onNavigate={onNavigate} />;
      default:
        return <HomePage onNavigate={onNavigate} />;
    }
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-900">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 font-sans text-gray-300 flex flex-col">
      <style>{`
        /* Dot Pattern Background */
        .dot-pattern {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image: radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.1) 1px, transparent 0);
          background-size: 20px 20px;
          opacity: 0.6;
          z-index: 0;
        }
        
        /* Hide scrollbar for Webkit browsers */
        .[&::-webkit-scrollbar]:hidden::-webkit-scrollbar {
          display: none;
        }
        
        /* Hide scrollbar for Firefox */
        .scrollbar-width-none {
          scrollbar-width: none;
        }
        
        /* Basic Animations */
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down { animation: fade-in-down 0.6s ease-out forwards; }
        
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
        
        /* Scroll Animations */
        @keyframes slide-in-up {
          from { opacity: 0; transform: translateY(50px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pop-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        /* Animated Gradient Text */
        .animated-gradient-text {
          background-image: linear-gradient(90deg, #38BDF8, #A78BFA, #F472B6, #38BDF8);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: text-gradient-shift 3s linear infinite;
        }
        @keyframes text-gradient-shift {
          to { background-position: 200% center; }
        }
        
        /* Shimmer Animation */
        .animate-shimmer {
          position: relative;
          overflow: hidden;
        }
        .animate-shimmer::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.1) 50%,
            transparent 100%
          );
          transform: translateX(-100%);
          animation: shimmer 3s infinite ease-in-out;
        }
        @keyframes shimmer {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }
        
        /* Pulse Animation */
        @keyframes pulse-fast {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.2; }
        }
        .group-hover\:animate-pulse-fast:hover {
          animation: pulse-fast 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        /* Floating Component Animation */
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        
        .animate-float {
          animation: float 10s ease-in-out infinite;
        }

        /* Gradient Card Animation */
        @keyframes gradient-pulse {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-pulse {
          background-size: 200% 200%;
          animation: gradient-pulse 3s ease-in-out infinite;
        }
      `}</style>
      
      {page !== 'login' && <Navbar onNavigate={onNavigate} />}
      <main className="flex-grow">
        {renderPage()}
      </main>
      {page !== 'login' && <Footer onNavigate={onNavigate} />}
    </div>
  );
};

// --- (H) Root Component ---

export default function App() {
  return (
    <ApiProvider>
      <AppContent />
    </ApiProvider>
  );
}

