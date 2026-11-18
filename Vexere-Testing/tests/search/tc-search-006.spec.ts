
import { test, expect } from '@playwright/test';
import path from 'path';
test('TC-SEARCH-006 - Tìm kiếm chuyến xe với thông tin hợp lệ', async ({ page }) => {

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });

  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Chọn điểm đi: 
    await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').click();
  await page.getByTestId('SearchWidget.from').fill('hanoi');
  await page.getByTestId('SearchWidget.from').press('Enter');

  // 9. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-006-PASS.png'),
    fullPage: true
  });

});