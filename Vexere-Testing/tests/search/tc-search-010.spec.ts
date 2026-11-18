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

test('TC-SEARCH-010 - Không chọn được ngày trong quá khứ', async ({ page }) => {
  test.skip(new Date().getDate() === 1, 'Hôm nay là ngày 1: ngày hôm qua không nằm trong lịch đang hiển thị');
  const homQua = ngayTu(-1);
  const ngayMai = ngayTu(1);

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Chọn điểm đi, điểm đến để mở lịch
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').click();
  await page.getByRole('paragraph').filter({ hasText: /^Hồ Chí Minh$/ }).click();
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').fill('Hà Nội');
  await page.getByRole('paragraph').filter({ hasText: /^Hà Nội$/ }).filter({ visible: true }).first().click();

  // 4. Quan sát lịch (2 tháng liền kề): ngày quá khứ có màu khác ngày hợp lệ
  if (!(await page.getByText(/^Tháng \d{1,2}, \d{4}$/).first().isVisible().catch(() => false))) {
    await page.getByRole('paragraph').filter({ hasText: 'Ngày đi' }).first().click();
  }
  const quaKhu = page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${homQua.ngay}$`) })
    .nth(homQua.thangLech);
  const tuongLai = page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${ngayMai.ngay}$`) })
    .nth(ngayMai.thangLech);
  const mau = (l: Locator) => l.evaluate(el => getComputedStyle(el).color);
  expect(await mau(quaKhu)).not.toBe(await mau(tuongLai));

  // 5. Nhấn ngày hôm qua: lịch vẫn mở, ô Ngày đi không nhận ngày này
  await quaKhu.click({ force: true });
  await expect(page.getByText(/^Tháng \d{1,2}, \d{4}$/).first()).toBeVisible();
  await expect(page.getByText(homQua.hienThi)).toHaveCount(0);

  // 6. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-010-PASS.png'),
    fullPage: true
  });

});