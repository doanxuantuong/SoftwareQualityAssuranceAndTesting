
import { test, expect } from '@playwright/test';

test('TC-SEARCH-001 - Tìm kiếm chuyến xe với thông tin hợp lệ', async ({ page }) => {

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });

  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Chọn điểm đi: Hồ Chí Minh
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').click();

  await page.getByRole('paragraph')
    .filter({ hasText: /^Hồ Chí Minh$/ })
    .click();

  // 4. Chọn điểm đến: Bà Rịa - Vũng Tàu
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').click();

  await page.getByText('Bà Rịa-Vũng Tàu').click();

  // 5. Chọn ngày khởi hành
  await page.getByText('21').first().click();

  // 6. Nhấn nút tìm kiếm
  await page.getByTestId('SearchWidget.search').click();

  // 7. Chờ trang kết quả tải
  await page.waitForLoadState('domcontentloaded');

  // 8. Kiểm tra website đã điều hướng khỏi trang chủ
  await expect(page).not.toHaveURL('https://vexere.com/');

  // 9. Chụp ảnh minh chứng
  await page.screenshot({
    path: 'screenshots/TC-SEARCH-001-PASS.png',
    fullPage: true
  });

});
