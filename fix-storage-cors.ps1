# Firebase Storage CORS Configuration Fix
# Run this script to fix the CORS error

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Firebase Storage Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Deploy Storage Rules
Write-Host "Step 1: Deploying Firebase Storage Rules..." -ForegroundColor Yellow
firebase deploy --only storage
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Storage rules deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to deploy storage rules" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Configuring CORS for Firebase Storage..." -ForegroundColor Yellow
Write-Host ""
Write-Host "To configure CORS, you need to use Google Cloud's gsutil command." -ForegroundColor Yellow
Write-Host "Follow these steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option A: Using Google Cloud Console (Easiest)" -ForegroundColor Cyan
Write-Host "1. Go to: https://console.cloud.google.com/storage/browser" -ForegroundColor White
Write-Host "2. Select your bucket: sreerasthusilvers-2d574.firebasestorage.app" -ForegroundColor White
Write-Host "3. Click on 'Permissions' tab" -ForegroundColor White
Write-Host "4. Click 'Add Principal'" -ForegroundColor White
Write-Host "5. Add 'allUsers' with role 'Storage Object Viewer'" -ForegroundColor White
Write-Host ""
Write-Host "Option B: Using gsutil command (Requires Google Cloud SDK)" -ForegroundColor Cyan
Write-Host "1. Install Google Cloud SDK from: https://cloud.google.com/sdk/docs/install" -ForegroundColor White
Write-Host "2. Run: gcloud auth login" -ForegroundColor White
Write-Host "3. Run: gsutil cors set cors.json gs://sreerasthusilvers-2d574.firebasestorage.app" -ForegroundColor White
Write-Host ""
Write-Host "Option C: Quick Fix via Firebase Console (Recommended)" -ForegroundColor Cyan
Write-Host "1. Go to: https://console.firebase.google.com" -ForegroundColor White
Write-Host "2. Select your project: sreerasthusilvers-2d574" -ForegroundColor White
Write-Host "3. Go to Storage section" -ForegroundColor White
Write-Host "4. Click on 'Rules' tab" -ForegroundColor White
Write-Host "5. The rules should now be updated from storage.rules file" -ForegroundColor White
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "After completing the above steps, refresh your browser and try uploading again." -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
