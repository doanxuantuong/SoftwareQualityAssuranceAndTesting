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

test('TC-SEARCH-028 - Đổi tuyến và ngày ở thanh tìm kiếm trên trang kết quả rồi tìm lại', async ({ page }) => {
  const homNay = ngayTu(0);
  const ngayMoi = ngayTu(1);

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Tìm Hải Phòng → Sa Pa - Lào Cai, hôm nay
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').fill('Hải Phòng');
  await page.getByRole('paragraph').filter({ hasText: /^Hải Phòng$/ }).first().click();
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').fill('Sa Pa');
  await page.getByRole('paragraph').filter({ hasText: /^Sa Pa - Lào Cai$/ }).first().click();
  if (!(await page.getByText(/^Tháng \d{1,2}, \d{4}$/).first().isVisible().catch(() => false))) {
    await page.getByRole('paragraph').filter({ hasText: 'Ngày đi' }).first().click();
  }
  await page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${homNay.ngay}$`) })
    .nth(homNay.thangLech)
    .click();
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/', { timeout: 20000 }),
    page.getByTestId('SearchWidget.search').click(),
  ]);
  await expect(page.getByText(/Kết quả[^:\n]*:\s*\d+\s*chuyến/).first()).toBeVisible({ timeout: 20000 });

  // 4. Ở thanh tìm kiếm trang kết quả: đổi Nơi đến thành Hà Nội và Ngày đi thành hôm nay + 1
  // (giả định thanh tìm kiếm ở trang kết quả dùng cùng bộ locator SearchWidget; nếu không khớp thì ghi lại bằng codegen)
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').click();
  await page.getByRole('paragraph').filter({ hasText: /^Hà Nội$/ }).click();
  if (!(await page.getByText(/^Tháng \d{1,2}, \d{4}$/).first().isVisible().catch(() => false))) {
    await page.getByRole('paragraph').filter({ hasText: 'Ngày đi' }).first().click();
  }
  await page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${ngayMoi.ngay}$`) })
    .nth(ngayMoi.thangLech)
    .click();
  await page.getByTestId('SearchWidget.search').click();

  // 5. Danh sách cập nhật theo tìm kiếm mới
  await expect(page.getByText(ngayMoi.hienThi).first()).toBeVisible();
  const tieuDe = page.getByText(/Kết quả[^:\n]*:\s*(\d+)\s*chuyến/).first();
  await expect(tieuDe).toBeVisible({ timeout: 20000 });
  expect(Number((await tieuDe.innerText()).match(/\d+/)![0])).toBeGreaterThan(0);

  // 6. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-028-PASS.png'),
    fullPage: true
  });

});
