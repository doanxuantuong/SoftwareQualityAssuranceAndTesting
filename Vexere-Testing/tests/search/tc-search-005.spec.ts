import { test, expect, Locator } from '@playwright/test';
import path from 'path';

// Giá trị đang hiển thị trong ô nhập (input hoặc ô dạng văn bản)
async function giaTri(loc: Locator) {
  return (await loc.inputValue().catch(() => loc.innerText())).trim();
}

test('TC-SEARCH-005 - Dropdown Nơi xuất phát hiển thị danh sách địa điểm và chọn được', async ({ page }) => {
  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Bật công tắc "Địa chỉ mới"
  const congTac = page.getByRole('switch').first();
  if ((await congTac.isChecked()) !== true) await congTac.click({ force: true });

  // 4. Nhấn ô Nơi xuất phát: danh sách mở ngay, có nhóm "Địa điểm phổ biến" và các địa điểm, có thanh cuộn
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').click();

  // Danh sách mở ngay khi nhấn ô (chờ tối đa 3 giây) với tiêu đề nhóm "Địa điểm phổ biến"
  const tieuDeNhom = page.getByText('Địa điểm phổ biến', { exact: true }).filter({ visible: true }).first();
  await expect(tieuDeNhom).toBeVisible({ timeout: 3000 });

  // Liệt kê các địa điểm quan sát được
  for (const ten of ['Hà Nội', 'Quảng Ninh', 'Ninh Bình', 'Đà Nẵng', 'Hồ Chí Minh', 'Sa Pa', 'Vũng Tàu']) {
    await expect(page.getByRole('paragraph').filter({ hasText: new RegExp(`^${ten}$`) }).filter({ visible: true }).first(), `Thiếu địa điểm ${ten}`).toBeVisible();
  }

  // Chỉ có nhóm "Địa điểm phổ biến", không có hai nhóm "Tỉnh / Thành phố" và "Quận / Huyện"
  await expect(page.getByText('Tỉnh / Thành phố', { exact: true }).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByText('Quận / Huyện', { exact: true }).filter({ visible: true })).toHaveCount(0);

  // Có thanh cuộn: tổ tiên gần nhất của tiêu đề nhóm có nội dung cao hơn khung nhìn và cho phép cuộn dọc
  const coThanhCuon = await tieuDeNhom.evaluate(el => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const kieu = getComputedStyle(p).overflowY;
      if ((kieu === 'auto' || kieu === 'scroll') && p.scrollHeight > p.clientHeight + 1) return true;
    }
    return false;
  });
  expect(coThanhCuon, 'Danh sách phải có thanh cuộn để xem thêm địa điểm').toBe(true);

  // 5. Chọn Hồ Chí Minh và kiểm tra ô Nơi xuất phát
  await page.getByRole('paragraph').filter({ hasText: /^Hồ Chí Minh$/ }).filter({ visible: true }).first().click();
  expect(await giaTri(page.getByRole('textbox', { name: 'Nơi xuất phát' }))).toContain('Hồ Chí Minh');

  // 6. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-005-PASS.png'),
    fullPage: true
  });

});