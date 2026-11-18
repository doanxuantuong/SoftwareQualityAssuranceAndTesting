
import { test, expect } from '@playwright/test';
import path from 'path';
test('TC-SEARCH-002 - Tìm kiếm chuyến xe với thông tin hợp lệ', async ({ page }) => {

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
  await page.getByRole('paragraph').filter({ hasText: /^Hồ Chí Minh$/ }).click();

  // 4. Chọn điểm đến:
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').click();
  await page.getByRole('paragraph').filter({ hasText: /^Nha Trang$/ }).click();

  // 5. Chọn ngày khởi hành
  await page.getByText('17').first().click();

  // 6. Nhấn nút tìm kiếm
  await page.getByTestId('SearchWidget.search').click();

  // 7. Chờ trang kết quả tải
  await page.waitForLoadState('domcontentloaded');

  // 8. Kiểm tra website đã điều hướng khỏi trang chủ
  await expect(page).not.toHaveURL('https://vexere.com/');

  // 9. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-002-PASS.png'),
  fullPage: true
  });

});