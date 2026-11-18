import { test, expect } from '@playwright/test';
import path from 'path';

test('TC-SEARCH-013 - Tìm kiếm khi chưa chọn Nơi xuất phát và Nơi đến', async ({ page }) => {
  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Không nhập gì, nhấn Tìm kiếm
  const urlTruoc = page.url();
  await page.getByTestId('SearchWidget.search').click();
  await page.waitForTimeout(2000);

  // 4. Không chuyển sang trang kết quả, địa chỉ trang không đổi
  expect(page.url()).toBe(urlTruoc);
  await expect(page.getByTestId('SearchWidget.search')).toBeVisible();
  // (Ghi lại: chưa thấy thông báo nào; nút Tìm kiếm nhạt màu)

  // 5. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-013-PASS.png'),
    fullPage: true
  });

});
