import { test, expect } from '@playwright/test';
import path from 'path';

const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// Ngày = hôm nay + soNgay. thangLech: 0 = tháng hiện tại, 1 = tháng kế tiếp (lịch hiển thị 2 tháng)
function ngayTu(soNgay: number) {
  const homNay = new Date();
  const d = new Date();
  d.setDate(d.getDate() + soNgay);
  const ngay = d.getDate();
  const thangLech = (d.getFullYear() - homNay.getFullYear()) * 12 + d.getMonth() - homNay.getMonth();
  const hienThi = `${THU[d.getDay()]}, ${String(ngay).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return { ngay, thangLech, hienThi };
}

test('TC-SEARCH-014 - Tìm kiếm khi thiếu Nơi đến', async ({ page }) => {
  const ngay = ngayTu(2);

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Chọn Nơi xuất phát là Hồ Chí Minh, để trống Nơi đến
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').click();
  await page.getByRole('paragraph').filter({ hasText: /^Hồ Chí Minh$/ }).click();

  // 4. Chọn Ngày đi là hôm nay + 2
  if (!(await page.getByText(/^Tháng \d{1,2}, \d{4}$/).first().isVisible().catch(() => false))) {
    await page.getByRole('paragraph').filter({ hasText: 'Ngày đi' }).first().click();
  }
  await page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${ngay.ngay}$`) })
    .nth(ngay.thangLech)
    .click();

  // 5. Nhấn Tìm kiếm
  const urlTruoc = page.url();
  await page.getByTestId('SearchWidget.search').click();
  await page.waitForTimeout(2000);

  // 6. Không chuyển trang; dữ liệu đã nhập vẫn được giữ
  expect(page.url()).toBe(urlTruoc);
  await expect(page.getByText(ngay.hienThi).first()).toBeVisible();

  // 7. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-014-PASS.png'),
    fullPage: true
  });

});
