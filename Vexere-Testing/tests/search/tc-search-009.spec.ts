import { test, expect } from '@playwright/test';
import path from 'path';
test('TC-SEARCH-009 - Ngày hiển thị khớp ngày đã chọn', async ({ page }) => {

  // Ngày đi = hôm nay + 7
  const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const homNay = new Date();
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const ngay = d.getDate();
  const thangLech = (d.getFullYear() - homNay.getFullYear()) * 12 + d.getMonth() - homNay.getMonth(); // 0 hoặc 1
  const ngayHienThi = `${THU[d.getDay()]}, ${String(ngay).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Chọn điểm đi
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').click();
  await page.getByRole('paragraph').filter({ hasText: /^Hồ Chí Minh$/ }).click();

  // 4. Chọn điểm đến (lịch tự mở sau bước này)
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').click();
  await page.getByRole('paragraph').filter({ hasText: /^Ninh Thuận$/ }).click();

  // 5. Chọn ngày dương (thẻ đầu tiên của ô ngày), bỏ qua ngày âm; nth() chọn đúng tháng
  await page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${ngay}$`) })
    .nth(thangLech)
    .click();
  await expect(page.getByText(ngayHienThi).first()).toBeVisible();

  // 6. Nhấn nút tìm kiếm và chờ chuyển sang trang kết quả
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/', { timeout: 20000 }),
    page.getByTestId('SearchWidget.search').click(),
  ]);

  // 7. Ngày ở trang kết quả khớp ngày đã chọn
  await expect(page.getByText(ngayHienThi).first()).toBeVisible();

  // 8. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-009-PASS.png'),
    fullPage: true
  });

});