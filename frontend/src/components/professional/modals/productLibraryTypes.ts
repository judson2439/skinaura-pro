// ============================================================================
// TYPES
// ============================================================================

export interface Product {
  id: string;
  professional_id?: string;
  name: string;
  brand: string;
  category: string;
  description?: string;
  price?: number;
  currency?: string;
  image_url?: string;
  purchase_url?: string;
  ingredients: string[];
  usage_instructions?: string;
  skin_types: string[];
  concerns?: string[];
  is_active?: boolean;
  is_global?: boolean;
  created_at: string;
  updated_at?: string;
}



export interface AIProductResult {
  name?: string;
  brand?: string;
  category?: string;
  description?: string;
  ingredients?: string[];
  skinTypes?: string[];
  usageInstructions?: string;
  confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const PRODUCT_CATEGORIES = [
  'Cleanser',
  'Toner',
  'Serum',
  'Moisturizer',
  'Sunscreen',
  'Treatment',
  'Eye Cream',
  'Mask',
  'Oil',
  'Exfoliant',
  'Essence',
  'Mist',
  'Lip Care',
  'Body Care',
] as const;

export const SKIN_TYPES = [
  'Normal',
  'Dry',
  'Oily',
  'Combination',
  'Sensitive',
  'Acne-Prone',
  'Mature',
  'All Skin Types',
] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const getConfidenceBadge = (confidence: string): string => {
  switch (confidence) {
    case 'high':
      return 'bg-green-100 text-green-700';
    case 'medium':
      return 'bg-amber-100 text-amber-700';
    case 'low':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

// ============================================================================
// MOCK DATA
// ============================================================================

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Vitamin C Brightening Serum',
    brand: 'SkinCeuticals',
    category: 'Serum',
    description: 'A potent vitamin C serum that brightens and protects the skin from environmental damage.',
    price: 165.00,
    image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&h=400&fit=crop',
    purchase_url: 'https://example.com/product1',
    ingredients: ['Vitamin C', 'Vitamin E', 'Ferulic Acid'],
    skin_types: ['Normal', 'Dry', 'Combination'],
    usage_instructions: 'Apply 3-4 drops to clean skin every morning before moisturizer.',
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'p2',
    name: 'Gentle Foaming Cleanser',
    brand: 'CeraVe',
    category: 'Cleanser',
    description: 'A gentle, non-irritating cleanser that removes dirt and oil without disrupting the skin barrier.',
    price: 14.99,
    image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=400&fit=crop',
    ingredients: ['Ceramides', 'Hyaluronic Acid', 'Niacinamide'],
    skin_types: ['All Skin Types'],
    usage_instructions: 'Massage onto damp skin morning and evening, then rinse thoroughly.',
    created_at: '2024-02-10T10:00:00Z',
  },
  {
    id: 'p3',
    name: 'Retinol 0.5% Treatment',
    brand: "Paula's Choice",
    category: 'Treatment',
    description: 'A beginner-friendly retinol treatment for reducing fine lines and improving texture.',
    price: 42.00,
    image_url: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=400&h=400&fit=crop',
    purchase_url: 'https://example.com/product3',
    ingredients: ['Retinol', 'Vitamin C', 'Peptides'],
    skin_types: ['Normal', 'Combination', 'Mature'],
    usage_instructions: 'Apply a pea-sized amount every other night, gradually increasing frequency.',
    created_at: '2024-03-05T10:00:00Z',
  },
  {
    id: 'p4',
    name: 'Hydrating Sunscreen SPF 50',
    brand: 'La Roche-Posay',
    category: 'Sunscreen',
    description: 'Lightweight, hydrating sunscreen with broad spectrum protection.',
    price: 33.99,
    image_url: 'https://images.unsplash.com/photo-1556227702-d1e4e7b5c232?w=400&h=400&fit=crop',
    ingredients: ['Zinc Oxide', 'Hyaluronic Acid', 'Glycerin'],
    skin_types: ['All Skin Types', 'Sensitive'],
    usage_instructions: 'Apply generously 15 minutes before sun exposure. Reapply every 2 hours.',
    created_at: '2024-04-01T10:00:00Z',
  },
  {
    id: 'p5',
    name: 'Niacinamide 10% + Zinc 1%',
    brand: 'The Ordinary',
    category: 'Serum',
    description: 'A high-strength vitamin and mineral formula to reduce blemishes and balance oil.',
    price: 6.50,
    ingredients: ['Niacinamide', 'Zinc PCA'],
    skin_types: ['Oily', 'Acne-Prone', 'Combination'],
    usage_instructions: 'Apply a few drops to face morning and evening before moisturizer.',
    created_at: '2024-04-15T10:00:00Z',
  },
  {
    id: 'p6',
    name: 'Ultra Facial Cream',
    brand: "Kiehl's",
    category: 'Moisturizer',
    description: '24-hour daily facial moisturizer for all skin types.',
    price: 52.00,
    image_url: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=400&fit=crop',
    purchase_url: 'https://example.com/product6',
    ingredients: ['Squalane', 'Glacial Glycoprotein', 'Antarcticine'],
    skin_types: ['All Skin Types'],
    usage_instructions: 'Apply morning and evening after serum.',
    created_at: '2024-05-01T10:00:00Z',
  },
];

