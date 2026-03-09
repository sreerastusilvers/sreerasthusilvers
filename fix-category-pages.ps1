# PowerShell script to fix all category pages to use CartContext

$categoryPages = @(
    @{File="DiamondRings.tsx"; Category="Diamond Rings"},
    @{File="DiamondNecklaces.tsx"; Category="Diamond Necklaces"},
    @{File="DiamondBracelets.tsx"; Category="Diamond Bracelets"},
    @{File="GoldRings.tsx"; Category="Gold Rings"},
    @{File="GoldNecklaces.tsx"; Category="Gold Necklaces"},
    @{File="GoldBracelets.tsx"; Category="Gold Bracelets"},
    @{File="SilverNecklaces.tsx"; Category="Silver Necklaces"},
    @{File="SilverBracelets.tsx"; Category="Silver Bracelets"},
    @{File="GemstoneRings.tsx"; Category="Gemstone Rings"},
    @{File="GemstoneNecklaces.tsx"; Category="Gemstone Necklaces"},
    @{File="GemstoneBracelets.tsx"; Category="Gemstone Bracelets"},
    @{File="PearlNecklaces.tsx"; Category="Pearl Necklaces"},
    @{File="PearlBracelets.tsx"; Category="Pearl Bracelets"},
    @{File="WeddingRings.tsx"; Category="Wedding Rings"},
    @{File="EngagementRings.tsx"; Category="Engagement Rings"},
    @{File="FashionRings.tsx"; Category="Fashion Rings"},
    @{File="CrossNecklaces.tsx"; Category="Cross Necklaces"},
    @{File="BangleBracelets.tsx"; Category="Bangle Bracelets"}
)

$basePath = "src\pages\categories"
$updatedFiles = 0

foreach ($page in $categoryPages) {
    $filePath = Join-Path $basePath $page.File
    $categoryName = $page.Category
    
    if (Test-Path $filePath) {
        Write-Host "Processing $($page.File)..." -ForegroundColor Cyan
        
        $content = Get-Content $filePath -Raw
        
        # 1. Add useCart import if not present
        if ($content -notmatch "import { useCart }") {
            $content = $content -replace '(import { Slider } from "@/components/ui/slider";)', "`$1`nimport { useCart } from `"@/contexts/CartContext`";"
        }
        
        # 2. Remove CartItem interface
        $content = $content -replace 'interface CartItem \{[^}]+\}\s*\n', ''
        
        # 3. Replace cart state with useCart hook
        $content = $content -replace 'const \[cart, setCart\] = useState<CartItem\[\]>\(\[\]\);', 'const { addToCart: addToCartContext } = useCart();'
        
        # 4. Replace addToCart function
        $oldAddToCart = 'const addToCart = \(product: UIProduct\) => \{[^}]+setCart\([^)]+\)[^}]+\};'
        $newAddToCart = @"
const addToCart = async (product: UIProduct) => {
    try {
      await addToCartContext({
        id: product.id,
        name: product.title,
        price: product.price,
        image: product.image,
        category: '$categoryName',
      });
      showToast('Added to cart', 'success', product.title);
    } catch (error) {
      console.error('Error adding to cart:', error);
      showToast('Failed to add to cart', 'error', product.title);
    }
  };
"@
        $content = $content -replace $oldAddToCart, $newAddToCart
        
        # 5. Remove cart calculations
        $content = $content -replace '\s*// Calculate cart totals\s*const cartItemCount = cart\.reduce[^;]+;\s*const cartTotal = cart\.reduce[^;]+;\s*', "`n`n"
        
        # Save the file
        Set-Content -Path $filePath -Value $content -NoNewline
        
        $updatedFiles++
        Write-Host "✓ Updated $($page.File)" -ForegroundColor Green
    } else {
        Write-Host "✗ File not found: $filePath" -ForegroundColor Red
    }
}

Write-Host "`nSummary: Updated $updatedFiles out of $($categoryPages.Count) files" -ForegroundColor Yellow
