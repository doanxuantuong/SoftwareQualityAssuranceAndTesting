
import { test, expect } from '@playwright/test';
import path from 'path';
test('TC-SEARCH-008 - Tìm kiếm chuyến xe với thông tin hợp lệ', async ({ page }) => {

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });

  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').click();
  await page.getByRole('paragraph').filter({ hasText: /^Hồ Chí Minh$/ }).click();
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').click();
  await page.getByTestId('SearchWidget.to').fill('Hà Nội');
  await page.locator('div').filter({ hasText: /^Hà Nội$/ }).nth(3).click();
  await page.getByText('import_export').click();

    await page.getByText('17').first().click();

  // 7. Chờ trang kết quả tải
  await page.waitForLoadState('domcontentloaded');

  // 9. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-008-PASS.png'),
    fullPage: true
  });

});