import { test, expect, Locator } from '@playwright/test';
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

test('TC-SEARCH-012 - Ngày về trước ngày đi không chọn được', async ({ page }) => {
  const di = ngayTu(5);
  const nho = ngayTu(3);
  const lon = ngayTu(6);

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Chọn điểm đi: Đắk Lắk
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').fill('Đắk Lắk');
  await page.getByRole('paragraph').filter({ hasText: /^Đắk Lắk$/ }).first().click();

  // 4. Chọn điểm đến: Vũng Tàu
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').click();
  await page.getByRole('paragraph').filter({ hasText: /^Vũng Tàu$/ }).click();

  // 5. Chọn ngày đi (hôm nay + 5)
  await page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${di.ngay}$`) })
    .nth(di.thangLech)
    .click();

  // 6. Nhấn "Thêm ngày về": ngày trước Ngày đi có màu khác ngày hợp lệ
  await page.getByText('Thêm ngày về').click();
  const truocNgayDi = page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${nho.ngay}$`) })
    .nth(nho.thangLech);
  const sauNgayDi = page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${lon.ngay}$`) })
    .nth(lon.thangLech);
  const mau = (l: Locator) => l.evaluate(el => getComputedStyle(el).color);
  expect(await mau(truocNgayDi)).not.toBe(await mau(sauNgayDi));

  // 7. Nhấn ngày hôm nay + 3 (trước Ngày đi): ô Ngày về không nhận ngày này
  await truocNgayDi.click({ force: true });
  await expect(page.getByText(nho.hienThi)).toHaveCount(0);

  // 8. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-012-PASS.png'),
    fullPage: true
  });

});
