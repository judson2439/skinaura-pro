import { jsPDF } from 'jspdf';
import { supabase } from './supabase';

// Types
interface SkinAnalysisData {
  photoUrl?: string | null;
  age: number;
  gender: string;
  expression: string;
  hydration: string;
  elasticity: string;
  evenness: string;
  radiance: string;
  fineWrinkles: string;
  eyeWrinkles: string;
  deepWrinkles: string;
  darkCircle: string;
  eyeBag: string;
  pores: string;
  pigment: string;
  redness: string;
  oiliness: string;
  dryness: string;
  sagginess: string;
  acne?: string;
  fineWrinklesTips?: string | null;
  eyeWrinklesTips?: string | null;
  deepWrinklesTips?: string | null;
  darkCircleTips?: string | null;
  eyeBagTips?: string | null;
  poresTips?: string | null;
  pigmentTips?: string | null;
  rednessTips?: string | null;
  oilinessTips?: string | null;
  drynessTips?: string | null;
  sagginessTips?: string | null;
  acneTips?: string | null;
}

// Routine types for PDF
interface RoutineProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  image_url: string | null;
  purchase_url: string | null;
}

interface RoutineStepWithProducts {
  id: string;
  step_order: number;
  step_name: string;
  description: string | null;
  duration_seconds: number | null;
  product_category: string | null;
  product_recommendation: string | null;
  tips: string | null;
  is_optional: boolean;
  products: RoutineProduct[];
}

interface RoutineForPDF {
  id: string;
  name: string;
  description: string | null;
  schedule_type: string;
  schedule_days: string[] | null;
  steps: RoutineStepWithProducts[];
}

// Metric descriptions
const METRIC_DESCRIPTIONS: Record<string, string> = {
  fineWrinkles: 'Fine wrinkles are the delicate, shallow lines or creases that gradually form as a natural part of the ageing process.',
  eyeWrinkles: 'Eye wrinkles are the small lines that form around the eyes, frequently brought on by repetitive facial expressions and the natural ageing process.',
  deepWrinkles: 'Deep wrinkles are more pronounced folds or lines in the skin. They usually develop from a combination of ageing and a loss of collagen.',
  darkCircle: 'Dark circles are the discoloured areas under the eyes, typically arising from lack of sleep, stress, or allergies.',
  eyeBag: 'Eye bags refer to the slight swellings or puffiness beneath the eyes. They often develop with age due to the weakening of the surrounding tissues.',
  pores: 'Pores are the tiny openings on the surface of the skin. When these become enlarged or blocked, they can lead to issues such as acne or uneven skin texture.',
  pigment: 'Pigment refers to the natural colouration of the skin. It can be influenced by factors such as sun exposure and hormonal changes.',
  redness: 'Redness refers to the appearance of a flushed or inflamed skin tone, often resulting from increased blood flow near the surface.',
  oiliness: 'Oiliness is characterised by an overproduction of sebum, the skin\'s natural oil. This condition gives the skin a shiny or greasy look.',
  dryness: 'Dryness describes a skin condition where the skin lacks sufficient moisture. It often feels tight, rough, or flaky.',
  sagginess: 'Sagginess is characterised by a loss of skin firmness and elasticity, often due to ageing and the effects of gravity.',
  acne: 'Acne is a common skin condition marked by the presence of pimples, blackheads, and whiteheads.',
};

// Convert image URL to base64
const imageToBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      console.error('Failed to fetch image:', response.status);
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Error converting image to base64:', err);
    return null;
  }
};

// Draw thin gradient bar with marker
const drawThinGradientBar = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  value: number
) => {
  const barHeight = 3; // Very thin bar height (3mm)
  const segmentWidth = width / 4;
  
  // Draw gradient segments (Good to Bad: green -> yellow -> orange -> red)
  const colors = [
    { r: 34, g: 197, b: 94 },   // Green
    { r: 234, g: 179, b: 8 },   // Yellow
    { r: 249, g: 115, b: 22 },  // Orange
    { r: 239, g: 68, b: 68 },   // Red
  ];
  
  // Draw each segment
  colors.forEach((color, i) => {
    doc.setFillColor(color.r, color.g, color.b);
    if (i === 0) {
      // First segment with rounded left corner
      doc.roundedRect(x + (i * segmentWidth), y, segmentWidth + 0.5, barHeight, 1.5, 1.5, 'F');
    } else if (i === 3) {
      // Last segment with rounded right corner
      doc.roundedRect(x + (i * segmentWidth) - 0.5, y, segmentWidth + 0.5, barHeight, 1.5, 1.5, 'F');
    } else {
      // Middle segments
      doc.rect(x + (i * segmentWidth), y, segmentWidth + 0.5, barHeight, 'F');
    }
  });
  
  // Calculate marker position (0% = left/good, 100% = right/bad)
  const markerX = x + (value / 100) * width;
  const markerY = y + barHeight / 2;
  
  // Draw marker (teal circle with white border)
  doc.setFillColor(13, 148, 136); // Teal
  doc.circle(markerX, markerY, 4, 'F');
  
  // Draw white border on marker
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1.2);
  doc.circle(markerX, markerY, 4, 'S');
};


// Parse tips string to array
const parseTips = (tipsString: string | null | undefined): string[] => {
  if (!tipsString) return [];
  return tipsString.split(';').map(tip => tip.trim()).filter(tip => tip.length > 0);
};

// Calculate overall skin health
const calculateSkinHealth = (data: SkinAnalysisData): number => {
  const hydration = parseInt(data.hydration) || 0;
  const elasticity = parseInt(data.elasticity) || 0;
  const evenness = parseInt(data.evenness) || 0;
  const radiance = parseInt(data.radiance) || 0;
  return Math.round((hydration + elasticity + evenness + radiance) / 4);
};

// Fetch routines for a client from database
// Logic flow:
// 1. Get routine_id list from client_routine_assignments where client_id matches current signed-in client
// 2. Get full data from routine_templates using routine_id list
// 3. Get full data from routine_steps using routine_id list
// 4. Get product_id from routine_step_products where routine_step_id matches
// 5. Get product info from products table where id matches product_id
const fetchClientRoutines = async (clientId: string): Promise<RoutineForPDF[]> => {
  try {
    // ============================================
    // STEP 1: Get routine_id list from client_routine_assignments
    // where client_id matches the current signed-in client's ID
    // ============================================
    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from('client_routine_assignments')
      .select('id, routine_id, client_id, is_active, assigned_at, notes')
      .eq('client_id', clientId)
      .eq('is_active', true);

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      return [];
    }

    if (!assignmentsData || assignmentsData.length === 0) {
      return [];
    }

    // Extract unique routine IDs
    const routineIds: string[] = [...new Set(assignmentsData.map(a => a.routine_id))];

    // ============================================
    // STEP 2: Get full data from routine_templates using routine_id list
    // ============================================
    const { data: routinesData, error: routinesError } = await supabase
      .from('routine_templates')
      .select('id, professional_id, name, description, schedule_type, schedule_days, is_active, created_at, updated_at')
      .in('id', routineIds)
      .eq('is_active', true);

    if (routinesError) {
      console.error('Error fetching routines:', routinesError);
      return [];
    }

    if (!routinesData || routinesData.length === 0) {
      return [];
    }

    // ============================================
    // STEP 3: Get full data from routine_steps using routine_id list
    // ============================================
    const { data: stepsData, error: stepsError } = await supabase
      .from('routine_steps')
      .select('id, routine_id, step_order, step_name, description, duration_seconds, product_category, product_recommendation, tips, is_optional, created_at')
      .in('routine_id', routineIds)
      .order('step_order', { ascending: true });

    if (stepsError) {
      console.error('Error fetching steps:', stepsError);
      return [];
    }

    const allSteps = stepsData || [];

    // Get all step IDs for fetching products
    const stepIds: string[] = allSteps.map(s => s.id);

    // ============================================
    // STEP 4: Get product_id from routine_step_products
    // where routine_step_id matches the step IDs
    // ============================================
    let stepProductsMap = new Map<string, RoutineProduct[]>();

    if (stepIds.length > 0) {
      const { data: stepProductsData, error: stepProductsError } = await supabase
        .from('routine_step_products')
        .select('id, routine_step_id, product_id')
        .in('routine_step_id', stepIds);

      if (stepProductsError) {
        console.error('Error fetching step products:', stepProductsError);
      } else if (stepProductsData && stepProductsData.length > 0) {
        // Extract unique product IDs
        const productIds: string[] = [...new Set(stepProductsData.map(sp => sp.product_id))];

        // ============================================
        // STEP 5: Get product info from products table
        // where id matches product_id from step 4
        // ============================================
        if (productIds.length > 0) {
          const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select('id, name, brand, category, description, price, image_url, purchase_url')
            .in('id', productIds);

          if (productsError) {
            console.error('Error fetching products:', productsError);
          } else if (productsData) {
            // Create a map of product_id -> product data
            const productsMap = new Map<string, RoutineProduct>();
            productsData.forEach(product => {
              productsMap.set(product.id, {
                id: product.id,
                name: product.name,
                brand: product.brand,
                category: product.category,
                description: product.description,
                price: product.price,
                image_url: product.image_url,
                purchase_url: product.purchase_url,
              });
            });

            // Group products by step ID using the step-product relationships
            stepProductsData.forEach(sp => {
              const stepId = sp.routine_step_id;
              const productId = sp.product_id;
              const product = productsMap.get(productId);
              
              if (product) {
                const existing = stepProductsMap.get(stepId) || [];
                existing.push(product);
                stepProductsMap.set(stepId, existing);
              }
            });
          }
        }
      }
    }

    // ============================================
    // STEP 6: Build the complete routines structure
    // combining all data from previous steps
    // ============================================
    
    // Group steps by routine_id
    const stepsMap = new Map<string, typeof allSteps>();
    allSteps.forEach(step => {
      const existing = stepsMap.get(step.routine_id) || [];
      existing.push(step);
      stepsMap.set(step.routine_id, existing);
    });

    // Build the final routines array with all data
    const routines: RoutineForPDF[] = routinesData.map(routine => {
      const routineSteps = stepsMap.get(routine.id) || [];
      
      return {
        id: routine.id,
        name: routine.name,
        description: routine.description,
        schedule_type: routine.schedule_type,
        schedule_days: routine.schedule_days,
        steps: routineSteps.map(step => {
          const stepProducts = stepProductsMap.get(step.id) || [];
          
          return {
            id: step.id,
            step_order: step.step_order,
            step_name: step.step_name,
            description: step.description,
            duration_seconds: step.duration_seconds,
            product_category: step.product_category,
            product_recommendation: step.product_recommendation,
            tips: step.tips,
            is_optional: step.is_optional,
            products: stepProducts,
          };
        }).sort((a, b) => a.step_order - b.step_order),
      };
    });

    return routines;
  } catch (error) {
    console.error('Error fetching client routines:', error);
    return [];
  }
};

// Get schedule type label
const getScheduleTypeLabel = (scheduleType: string): string => {
  switch (scheduleType) {
    case 'morning': return 'Morning Routine';
    case 'evening': return 'Evening Routine';
    case 'daily': return 'Daily Routine';
    case 'weekly': return 'Weekly Routine';
    default: return `${scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)} Routine`;
  }
};

// Get schedule type color
const getScheduleTypeColor = (scheduleType: string): { r: number; g: number; b: number } => {
  switch (scheduleType) {
    case 'morning': return { r: 251, g: 191, b: 36 }; // Amber
    case 'evening': return { r: 99, g: 102, b: 241 }; // Indigo
    case 'daily': return { r: 34, g: 197, b: 94 }; // Green
    case 'weekly': return { r: 168, g: 85, b: 247 }; // Purple
    default: return { r: 107, g: 114, b: 128 }; // Gray
  }
};

// Draw routines pages - Clean layout matching the design
const drawRoutinesPages = async (
  doc: jsPDF,
  routines: RoutineForPDF[],
  margin: number,
  contentWidth: number,
  pageHeight: number
): Promise<void> => {
  if (routines.length === 0) return;

  // Process each routine on its own page(s)
  for (const routine of routines) {
    // Add new page for each routine
    doc.addPage();
    let currentY = margin;

    // ============================================
    // LOGO AT TOP OF ROUTINE PAGE
    // ============================================
    const logoUrl = 'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png';
    const logoHeight = 12;
    const logoWidth = 40;
    
    try {
      const logoBase64 = await imageToBase64(logoUrl);
      if (logoBase64) {
        const logoX = (doc.internal.pageSize.getWidth() - logoWidth) / 2;
        doc.addImage(logoBase64, 'PNG', logoX, currentY, logoWidth, logoHeight);
        currentY += logoHeight + 6;
      }
    } catch {
      currentY += 3;
    }

    // ============================================
    // ROUTINE TITLE - "Your [Schedule Type] Routine"
    // ============================================
    const routineTitle = `Your ${routine.schedule_type.charAt(0).toUpperCase() + routine.schedule_type.slice(1)} Routine`;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(45, 42, 62);
    doc.text(routineTitle, doc.internal.pageSize.getWidth() / 2, currentY + 8, { align: 'center' });
    
    currentY += 20;

    // Routine name if different from schedule type
    if (routine.name && routine.name.toLowerCase() !== routine.schedule_type.toLowerCase()) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(routine.name, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
      currentY += 10;
    }

    currentY += 10;

    // ============================================
    // DRAW STEPS IN 2-COLUMN GRID
    // ============================================
    const stepColumnCount = 2;
    const stepGap = 8;
    const stepCardWidth = (contentWidth - stepGap) / stepColumnCount;
    
    // Calculate step card height based on content
    const getStepCardHeight = (step: RoutineStepWithProducts): number => {
      const headerHeight = 14;
      const descHeight = step.description ? 25 : 5; // Larger description space
      const productCardHeight = 40 + 30; // Image (40) + text space (30)
      const productHeight = step.products.length > 0 ? (step.products.length * (productCardHeight + 4)) + 5 : 0;
      return headerHeight + descHeight + productHeight + 15;
    };

    // Process steps in pairs (2 columns)
    for (let stepIdx = 0; stepIdx < routine.steps.length; stepIdx += stepColumnCount) {
      // Get the max height for this row of steps
      let maxRowHeight = 0;
      for (let col = 0; col < stepColumnCount && (stepIdx + col) < routine.steps.length; col++) {
        const stepHeight = getStepCardHeight(routine.steps[stepIdx + col]);
        if (stepHeight > maxRowHeight) maxRowHeight = stepHeight;
      }

      // Check if we need a new page for this row
      if (currentY + maxRowHeight > pageHeight - 20) {
        doc.addPage();
        currentY = margin;
        
        // Add continuation title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(45, 42, 62);
        doc.text(`${routineTitle} (continued)`, doc.internal.pageSize.getWidth() / 2, currentY + 8, { align: 'center' });
        currentY += 25;
      }

      // Draw up to 2 steps in this row
      for (let col = 0; col < stepColumnCount && (stepIdx + col) < routine.steps.length; col++) {
        const step = routine.steps[stepIdx + col];
        const stepCardX = margin + (col * (stepCardWidth + stepGap));
        let stepY = currentY;

        // Step card background and border
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(230, 220, 215);
        doc.setLineWidth(0.5);
        doc.roundedRect(stepCardX, stepY, stepCardWidth, maxRowHeight, 5, 5, 'FD');

        stepY += 8;

        // ============================================
        // STEP HEADER: "1. Cleanser" - With accent color
        // ============================================
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(207, 175, 163); // #CFAFA3 - SkinAura accent color
        doc.text(`${step.step_order}. `, stepCardX + 6, stepY);
        
        // Step name in dark color
        const stepNumWidth = doc.getTextWidth(`${step.step_order}. `);
        doc.setTextColor(45, 42, 62);
        const stepNameMaxWidth = stepCardWidth - stepNumWidth - 12;
        const stepNameTrunc = step.step_name.length > 18 
          ? step.step_name.substring(0, 18) + '...' 
          : step.step_name;
        doc.text(stepNameTrunc, stepCardX + 6 + stepNumWidth, stepY);
        stepY += 8;

        // ============================================
        // STEP DESCRIPTION/INSTRUCTIONS - Larger font
        // ============================================
        if (step.description) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10); // Increased font size
          doc.setTextColor(100, 85, 75); // Warm gray
          const descLines = doc.splitTextToSize(step.description, stepCardWidth - 12);
          const maxDescLines = descLines.slice(0, 3); // Max 3 lines
          doc.text(maxDescLines, stepCardX + 6, stepY);
          stepY += maxDescLines.length * 5 + 6;
        } else {
          stepY += 4;
        }

        // ============================================
        // PRODUCT CARDS - Vertical layout (image on top, info below)
        // ============================================
        if (step.products.length > 0) {
          const productCardWidth = stepCardWidth - 12;
          const imageSize = 40;
          const productCardHeight = imageSize + 30; // Image + text space

          for (let pIdx = 0; pIdx < step.products.length; pIdx++) {
            const product = step.products[pIdx];
            const productCardX = stepCardX + 6;

            // Product card background
            doc.setFillColor(250, 248, 246);
            doc.setDrawColor(240, 235, 230);
            doc.setLineWidth(0.3);
            doc.roundedRect(productCardX, stepY, productCardWidth, productCardHeight, 3, 3, 'FD');

            // Product image - centered at top
            const imageX = productCardX + (productCardWidth - imageSize) / 2;
            const imageY = stepY + 5;
            
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(235, 230, 225);
            doc.roundedRect(imageX, imageY, imageSize, imageSize, 3, 3, 'FD');
            
            if (product.image_url) {
              try {
                const base64Image = await imageToBase64(product.image_url);
                if (base64Image) {
                  doc.addImage(base64Image, 'JPEG', imageX + 2, imageY + 2, imageSize - 4, imageSize - 4);
                } else {
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(8);
                  doc.setTextColor(200, 190, 185);
                  doc.text('IMG', imageX + imageSize / 2, imageY + imageSize / 2 + 2, { align: 'center' });
                }
              } catch {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(200, 190, 185);
                doc.text('IMG', imageX + imageSize / 2, imageY + imageSize / 2 + 2, { align: 'center' });
              }
            } else {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(200, 190, 185);
              doc.text('IMG', imageX + imageSize / 2, imageY + imageSize / 2 + 2, { align: 'center' });
            }

            // Product info - below image, centered
            let textY = stepY + imageSize + 10;
            const centerX = productCardX + productCardWidth / 2;

            // Product name (centered)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(45, 42, 62);
            const productName = product.name.length > 25 
              ? product.name.substring(0, 25) + '...' 
              : product.name;
            doc.text(productName, centerX, textY, { align: 'center' });
            textY += 7;

            // Product category (centered, accent color)
            if (product.category) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(207, 175, 163); // Accent color
              const categoryText = product.category.length > 22 
                ? product.category.substring(0, 22) + '...' 
                : product.category;
              doc.text(categoryText, centerX, textY, { align: 'center' });
              textY += 6;
            }

            // Brand name (centered)
            if (product.brand) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7);
              doc.setTextColor(150, 140, 135);
              const brandText = product.brand.length > 22 
                ? product.brand.substring(0, 22) + '...' 
                : product.brand;
              doc.text(brandText, centerX, textY, { align: 'center' });
            }

            stepY += productCardHeight + 4;
          }
        }
      }

      currentY += maxRowHeight + 8;
    }
  }
};

// Main export function
export const exportSkinAnalysisPDF = async (
  data: SkinAnalysisData,
  clientId?: string
): Promise<void> => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let currentY = margin;
    
    // ============================================
    // LOGO
    // ============================================
    const logoUrl = 'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png';
    const logoHeight = 15;
    const logoWidth = 50; // Approximate width based on aspect ratio
    
    try {
      const logoBase64 = await imageToBase64(logoUrl);
      if (logoBase64) {
        // Center the logo
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(logoBase64, 'PNG', logoX, currentY, logoWidth, logoHeight);
        currentY += logoHeight + 8;
      }
    } catch (err) {
      console.error('Error loading logo:', err);
      // If logo fails to load, just add some spacing
      currentY += 5;
    }

    // ============================================
    // HEADER
    // ============================================
    doc.setFillColor(45, 42, 62); // Dark purple background
    doc.roundedRect(margin, currentY, contentWidth, 16, 3, 3, 'F');
    
    // SkinAura AI logo text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(207, 175, 163); // #CFAFA3
    doc.text('SkinAura Pro', margin + 5, currentY + 10);
    
    // Report title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('Skin Analysis Report', pageWidth - margin - 5, currentY + 10, { align: 'right' });
    
    currentY += 22;
    
    // ============================================
    // PHOTO AND SUMMARY SECTION
    // ============================================
    const photoSize = 40;
    const summaryX = margin + photoSize + 10;
    const summaryWidth = contentWidth - photoSize - 10;
    
    // Draw photo placeholder or actual photo
    let photoLoaded = false;
    if (data.photoUrl) {
      try {
        const base64Image = await imageToBase64(data.photoUrl);
        if (base64Image) {
          // Draw rounded rectangle background
          doc.setFillColor(240, 240, 240);
          doc.roundedRect(margin, currentY, photoSize, photoSize, 4, 4, 'F');
          
          // Add image
          doc.addImage(base64Image, 'JPEG', margin + 2, currentY + 2, photoSize - 4, photoSize - 4);
          photoLoaded = true;
        }
      } catch (err) {
        console.error('Error adding photo to PDF:', err);
      }
    }
    
    if (!photoLoaded) {
      // Draw placeholder
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(margin, currentY, photoSize, photoSize, 4, 4, 'F');
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('No Photo', margin + photoSize / 2, currentY + photoSize / 2, { align: 'center' });
    }
    
    // Summary info
    const skinHealth = calculateSkinHealth(data);
    
    // Skin Age
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(45, 42, 62);
    doc.text('Skin Age:', summaryX, currentY + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(13, 148, 136); // Teal
    doc.text(String(data.age), summaryX + 22, currentY + 8);
    
    // Skin Health
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(45, 42, 62);
    doc.text('Skin Health:', summaryX, currentY + 18);
    doc.setFontSize(16);
    doc.setTextColor(13, 148, 136);
    doc.text(`${skinHealth}%`, summaryX + 26, currentY + 18);
    
    // Gender and Expression
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gender: ${data.gender} | Expression: ${data.expression}`, summaryX, currentY + 28);
    
    // General tip
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const generalTip = 'Keep your skin healthy by staying hydrated, protecting it from the sun, and following a consistent daily routine.';
    const tipLines = doc.splitTextToSize(generalTip, summaryWidth - 5);
    doc.text(tipLines, summaryX, currentY + 36);
    
    currentY += photoSize + 12;
    
    // ============================================
    // METRICS SECTION HEADER
    // ============================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(45, 42, 62);
    doc.text('Detailed Skin Analysis', margin, currentY);
    currentY += 10;
    
    // ============================================
    // METRICS SECTION - TWO COLUMN GRID
    // ============================================
    const metrics = [
      { key: 'fineWrinkles', label: 'Fine Wrinkles', value: data.fineWrinkles, tips: data.fineWrinklesTips },
      { key: 'eyeWrinkles', label: 'Eye Wrinkles', value: data.eyeWrinkles, tips: data.eyeWrinklesTips },
      { key: 'deepWrinkles', label: 'Deep Wrinkles', value: data.deepWrinkles, tips: data.deepWrinklesTips },
      { key: 'darkCircle', label: 'Dark Circle', value: data.darkCircle, tips: data.darkCircleTips },
      { key: 'eyeBag', label: 'Eye Bag', value: data.eyeBag, tips: data.eyeBagTips },
      { key: 'pores', label: 'Pores', value: data.pores, tips: data.poresTips },
      { key: 'pigment', label: 'Pigment', value: data.pigment, tips: data.pigmentTips },
      { key: 'redness', label: 'Redness', value: data.redness, tips: data.rednessTips },
      { key: 'oiliness', label: 'Oiliness', value: data.oiliness, tips: data.oilinessTips },
      { key: 'dryness', label: 'Dryness', value: data.dryness, tips: data.drynessTips },
      { key: 'sagginess', label: 'Sagginess', value: data.sagginess, tips: data.sagginessTips },
    ];
    
    // Filter out acne if value is 0 or not present
    if (data.acne && parseInt(data.acne) > 0) {
      metrics.push({ key: 'acne', label: 'Acne', value: data.acne, tips: data.acneTips });
    }
    
    // Two column layout
    const columnWidth = (contentWidth - 10) / 2; // 10mm gap between columns
    const columnGap = 10;
    
    // Calculate metric height dynamically based on tips
    const getMetricHeight = (metric: typeof metrics[0]): number => {
      const tips = parseTips(metric.tips);
      const baseHeight = 32; // Title + bar + description
      const tipsHeight = tips.length > 0 ? 6 + (tips.length * 5) : 0;
      return baseHeight + tipsHeight;
    };
    
    // Draw a single metric

    const drawMetric = (metric: typeof metrics[0], x: number, y: number, width: number): number => {
      const value = parseInt(metric.value) || 0;
      const tips = parseTips(metric.tips);
      let localY = y;
      
      // Metric title with value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(45, 42, 62);
      doc.text(metric.label, x, localY);
      
      // Value percentage (colored based on value)
      const valueColor = value <= 30 ? { r: 34, g: 197, b: 94 } : value <= 60 ? { r: 234, g: 179, b: 8 } : { r: 239, g: 68, b: 68 };
      doc.setTextColor(valueColor.r, valueColor.g, valueColor.b);
      doc.text(`${value}%`, x + 35, localY);
      
      localY += 5;
      
      // Good/Bad labels - BIGGER font size (10pt)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text('Good', x, localY);
      doc.text('Bad', x + width, localY, { align: 'right' });
      
      localY += 4;
      
      // Very thin gradient bar
      drawThinGradientBar(doc, x, localY, width, value);
      
      localY += 8;
      
      // Description - BIGGER font size (10pt) - larger than tips
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const description = METRIC_DESCRIPTIONS[metric.key] || '';
      const descLines = doc.splitTextToSize(description, width);
      doc.text(descLines, x, localY);
      localY += descLines.length * 4;
      
      // Tips as list items (if available) - smaller font than description (9pt)
      if (tips.length > 0) {
        localY += 3;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        
        tips.forEach((tip) => {
          // Bullet point (teal circle)
          doc.setFillColor(13, 148, 136);
          doc.circle(x + 2, localY - 1.5, 1.2, 'F');
          
          // Tip text
          const tipLines = doc.splitTextToSize(tip, width - 8);
          doc.text(tipLines, x + 6, localY);
          localY += tipLines.length * 3.8;
        });
      }
      
      return localY;
    };

    
    // Process metrics in pairs for two-column layout
    let leftY = currentY;
    let rightY = currentY;
    
    for (let i = 0; i < metrics.length; i++) {
      const metric = metrics[i];
      const isLeftColumn = i % 2 === 0;
      const x = isLeftColumn ? margin : margin + columnWidth + columnGap;
      const startY = isLeftColumn ? leftY : rightY;
      
      // Check if we need a new page
      const metricHeight = getMetricHeight(metric);
      if (startY + metricHeight > pageHeight - 20) {
        // Add new page
        doc.addPage();
        leftY = margin;
        rightY = margin;
        
        // Reset position for this metric
        if (isLeftColumn) {
          const endY = drawMetric(metric, margin, leftY, columnWidth);
          leftY = endY + 8;
        } else {
          const endY = drawMetric(metric, margin + columnWidth + columnGap, rightY, columnWidth);
          rightY = endY + 8;
        }
      } else {
        if (isLeftColumn) {
          const endY = drawMetric(metric, x, leftY, columnWidth);
          leftY = endY + 8;
        } else {
          const endY = drawMetric(metric, x, rightY, columnWidth);
          rightY = endY + 8;
        }
      }
      
      // Sync columns after each pair
      if (!isLeftColumn || i === metrics.length - 1) {
        const maxY = Math.max(leftY, rightY);
        leftY = maxY;
        rightY = maxY;
      }
    }

    // ============================================
    // FETCH AND ADD ROUTINES PAGES
    // ============================================
    if (clientId) {
      const routines = await fetchClientRoutines(clientId);
      if (routines.length > 0) {
        await drawRoutinesPages(doc, routines, margin, contentWidth, pageHeight);
      }
    }
    
    // ============================================
    // FOOTER ON EACH PAGE
    // ============================================
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const footerY = pageHeight - 8;
      
      // Footer line
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
      
      // Footer text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated by SkinAura Pro - ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, footerY);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
    }
    
    // Save the PDF
    const fileName = `SkinAura_Analysis_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

// Export from history entry
export const exportHistoryEntryPDF = async (
  entry: {
    photo_url: string | null;
    age: number;
    gender: string;
    expression: string;
    hydration: string;
    elasticity: string;
    evenness: string;
    radiance: string;
    fine_wrinkles: string;
    eye_wrinkles: string;
    deep_wrinkles: string;
    dark_circle: string;
    eye_bag: string;
    pores: string;
    pigment: string;
    redness: string;
    oiliness: string;
    dryness: string;
    sagginess: string;
    acne?: string;
    fine_wrinkles_tips: string | null;
    eye_wrinkles_tips: string | null;
    deep_wrinkles_tips: string | null;
    dark_circle_tips: string | null;
    eye_bag_tips: string | null;
    pores_tips: string | null;
    pigment_tips: string | null;
    redness_tips: string | null;
    oiliness_tips: string | null;
    dryness_tips: string | null;
    sagginess_tips: string | null;
    acne_tips?: string | null;
  },
  clientId?: string
): Promise<void> => {
  const data: SkinAnalysisData = {
    photoUrl: entry.photo_url,
    age: entry.age,
    gender: entry.gender,
    expression: entry.expression,
    hydration: entry.hydration,
    elasticity: entry.elasticity,
    evenness: entry.evenness,
    radiance: entry.radiance,
    fineWrinkles: entry.fine_wrinkles,
    eyeWrinkles: entry.eye_wrinkles,
    deepWrinkles: entry.deep_wrinkles,
    darkCircle: entry.dark_circle,
    eyeBag: entry.eye_bag,
    pores: entry.pores,
    pigment: entry.pigment,
    redness: entry.redness,
    oiliness: entry.oiliness,
    dryness: entry.dryness,
    sagginess: entry.sagginess,
    acne: entry.acne,
    fineWrinklesTips: entry.fine_wrinkles_tips,
    eyeWrinklesTips: entry.eye_wrinkles_tips,
    deepWrinklesTips: entry.deep_wrinkles_tips,
    darkCircleTips: entry.dark_circle_tips,
    eyeBagTips: entry.eye_bag_tips,
    poresTips: entry.pores_tips,
    pigmentTips: entry.pigment_tips,
    rednessTips: entry.redness_tips,
    oilinessTips: entry.oiliness_tips,
    drynessTips: entry.dryness_tips,
    sagginessTips: entry.sagginess_tips,
    acneTips: entry.acne_tips,
  };
  
  await exportSkinAnalysisPDF(data, clientId);
};

// Export from current metrics (live analysis)
export const exportCurrentAnalysisPDF = async (
  metrics: {
    estimatedAge: number;
    gender: string;
    expressions: Record<string, number>;
    skinMetrics: {
      fineWrinkles: number;
      eyeWrinkles: number;
      deepWrinkles: number;
      darkCircle: number;
      eyeBag: number;
      pores: number;
      pigment: number;
      redness: number;
      oiliness: number;
      dryness: number;
      sagginess: number;
      acne?: number;
    };
    hydration: number;
    elasticity: number;
    evenness: number;
    radiance: number;
  },
  photoData: string | null,
  skinTips: Record<string, string[]>,
  clientId?: string
): Promise<void> => {
  // Get dominant expression
  const expressions = Object.entries(metrics.expressions);
  const dominantExpression = expressions.sort((a, b) => b[1] - a[1])[0][0];
  
  const data: SkinAnalysisData = {
    photoUrl: photoData,
    age: metrics.estimatedAge,
    gender: metrics.gender,
    expression: dominantExpression,
    hydration: metrics.hydration.toString(),
    elasticity: metrics.elasticity.toString(),
    evenness: metrics.evenness.toString(),
    radiance: metrics.radiance.toString(),
    fineWrinkles: metrics.skinMetrics.fineWrinkles.toString(),
    eyeWrinkles: metrics.skinMetrics.eyeWrinkles.toString(),
    deepWrinkles: metrics.skinMetrics.deepWrinkles.toString(),
    darkCircle: metrics.skinMetrics.darkCircle.toString(),
    eyeBag: metrics.skinMetrics.eyeBag.toString(),
    pores: metrics.skinMetrics.pores.toString(),
    pigment: metrics.skinMetrics.pigment.toString(),
    redness: metrics.skinMetrics.redness.toString(),
    oiliness: metrics.skinMetrics.oiliness.toString(),
    dryness: metrics.skinMetrics.dryness.toString(),
    sagginess: metrics.skinMetrics.sagginess.toString(),
    acne: metrics.skinMetrics.acne?.toString(),
    fineWrinklesTips: skinTips.fineWrinkles?.join('; ') || null,
    eyeWrinklesTips: skinTips.eyeWrinkles?.join('; ') || null,
    deepWrinklesTips: skinTips.deepWrinkles?.join('; ') || null,
    darkCircleTips: skinTips.darkCircle?.join('; ') || null,
    eyeBagTips: skinTips.eyeBag?.join('; ') || null,
    poresTips: skinTips.pores?.join('; ') || null,
    pigmentTips: skinTips.pigment?.join('; ') || null,
    rednessTips: skinTips.redness?.join('; ') || null,
    oilinessTips: skinTips.oiliness?.join('; ') || null,
    drynessTips: skinTips.dryness?.join('; ') || null,
    sagginessTips: skinTips.sagginess?.join('; ') || null,
    acneTips: skinTips.acne?.join('; ') || null,
  };
  
  await exportSkinAnalysisPDF(data, clientId);
};
