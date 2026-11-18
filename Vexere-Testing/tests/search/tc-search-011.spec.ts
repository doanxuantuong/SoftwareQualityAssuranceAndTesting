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

test('TC-SEARCH-011 - Tìm chuyến khứ hồi với ngày về sau ngày đi', async ({ page }) => {
  const di = ngayTu(3);
  const ve = ngayTu(5);

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
  await page.getByRole('paragraph').filter({ hasText: /^Hồ Chí Minh$/ }).click();

  // 4. Chọn điểm đến: Đắk Lắk
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').fill('Đắk Lắk');
  await page.getByRole('paragraph').filter({ hasText: /^Đắk Lắk$/ }).first().click();

  // 5. Chọn ngày đi (hôm nay + 3)
  await page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${di.ngay}$`) })
    .nth(di.thangLech)
    .click();

  // 6. Nhấn "Thêm ngày về" và chọn ngày về (hôm nay + 5)
  await page.getByText('Thêm ngày về').click();
  await page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${ve.ngay}$`) })
    .nth(ve.thangLech)
    .click();
  await expect(page.getByText(ve.hienThi).first()).toBeVisible();

  // 7. Nhấn nút tìm kiếm
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/', { timeout: 20000 }),
    page.getByTestId('SearchWidget.search').click(),
  ]);

  // 8. Tiêu đề "Kết quả chiều đi: N chuyến"; thanh tìm kiếm hiển thị cả hai ngày
  await expect(page.getByText(/Kết quả chiều đi:\s*\d+\s*chuyến/).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(di.hienThi).first()).toBeVisible();
  await expect(page.getByText(ve.hienThi).first()).toBeVisible();

  // 9. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-011-PASS.png'),
    fullPage: true
  });

});
