import { test, expect, Locator } from '@playwright/test';
import path from 'path';

// Giá trị đang hiển thị trong ô nhập (input hoặc ô dạng văn bản)
async function giaTri(loc: Locator) {
  return (await loc.inputValue().catch(() => loc.innerText())).trim();
}

test('TC-SEARCH-025 - Gõ địa điểm: để trống, có dấu, chữ hoa, không tồn tại, ký tự đặc biệt', async ({ page }) => {
  const loi: string[] = [];
  page.on('pageerror', e => loi.push(e.message));
  const phoBien = page.getByText('Địa điểm phổ biến', { exact: true }).filter({ visible: true }).first();
  const coGoiY = page.getByText('place', { exact: true }).filter({ visible: true });   // biểu tượng ghim trước mỗi dòng gợi ý
  const haNoi = page.getByRole('paragraph').filter({ hasText: /^Hà Nội$/ }).filter({ visible: true }).first();

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Tắt công tắc "Địa chỉ mới"
  const congTac = page.getByRole('switch').first();
  if ((await congTac.isChecked()) !== false) await congTac.click({ force: true });

  // 4. Nhấn ô Nơi xuất phát khi chưa gõ gì: hiện nhóm "Địa điểm phổ biến" (khi tắt "Địa chỉ mới")
  await page.getByText('Nơi xuất phát').click();
  const oDiemDi = page.getByTestId('SearchWidget.from');
  await oDiemDi.click();
  await expect(phoBien).toBeVisible();
  await expect(haNoi).toBeVisible();

  // 5. Gõ "ha noi", "Hà Nội", "HA NOI": mỗi lần đều có gợi ý Hà Nội; chọn Hà Nội
  for (const tuKhoa of ['ha noi', 'Hà Nội', 'HA NOI']) {
    await oDiemDi.fill('');
    await oDiemDi.pressSequentially(tuKhoa, { delay: 60 });
    await expect(haNoi).toBeVisible();
  }
  await haNoi.click();
  expect(await giaTri(oDiemDi)).toContain('Hà Nội');

  // 6. Ô Nơi đến: gõ "hai phong", chọn Hải Phòng
  await page.getByText('Nơi đến').click();
  const oDiemDen = page.getByTestId('SearchWidget.to');
  await oDiemDen.click();
  await oDiemDen.pressSequentially('hai phong', { delay: 60 });
  await page.getByRole('paragraph').filter({ hasText: /^Hải Phòng(, [^,]+)?$/ }).filter({ visible: true }).first().click();
  expect(await giaTri(oDiemDen)).toContain('Hải Phòng');

  // 7. Gõ "aloalo": không có gợi ý
  await oDiemDen.fill('');
  await oDiemDen.pressSequentially('aloalo', { delay: 60 });
  await expect(coGoiY).toHaveCount(0);

  // 8. Gõ chuỗi đặc biệt: không có gợi ý, hiển thị dạng văn bản, không thực thi mã, không lỗi trang
  await oDiemDen.fill('');
  await oDiemDen.pressSequentially('<b>x</b>@#$%', { delay: 60 });
  await expect(coGoiY).toHaveCount(0);
  await expect(page.locator('b', { hasText: /^x$/ })).toHaveCount(0);
  expect(loi).toEqual([]);

  // 9. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-025-PASS.png'),
    fullPage: true
  });

});