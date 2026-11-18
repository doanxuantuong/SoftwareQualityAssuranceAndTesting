import { test, expect, Locator } from '@playwright/test';
import path from 'path';

// Giá trị đang hiển thị trong ô nhập (input hoặc ô dạng văn bản)
async function giaTri(loc: Locator) {
  return (await loc.inputValue().catch(() => loc.innerText())).trim();
}

test('TC-SEARCH-024 - Nhấn nút đổi chiều khi chưa chọn đủ hai địa điểm', async ({ page }) => {
  const loi: string[] = [];
  page.on('pageerror', e => loi.push(e.message));

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Chọn Nơi xuất phát là Hà Nội
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').fill('Hà Nội');
  await page.getByRole('paragraph').filter({ hasText: /^Hà Nội(, [^,]+)?$/ }).filter({ visible: true }).first().click();

  // 4. Nhấn nút đổi chiều một lần, quan sát hai ô
  for (let lan = 1; lan <= 1; lan++) {
    await page.getByText('import_export').click();
    const di = await giaTri(page.getByRole('textbox', { name: 'Nơi xuất phát' }));
    const den = await giaTri(page.getByRole('textbox', { name: 'Nơi đến' }));
    console.log(`Lần ${lan}: Nơi xuất phát="${di}" | Nơi đến="${den}"`);
    // Không có giá trị lạ, Hà Nội không bị nhân đôi
    for (const v of [di, den]) expect(v).not.toMatch(/undefined|null/);
    expect(di.includes('Hà Nội') && den.includes('Hà Nội'), `Lần ${lan}: Hà Nội bị nhân đôi (đi="${di}", đến="${den}")`).toBe(false);
  }

  // 5. Không lỗi trang
  expect(loi).toEqual([]);

  // 6. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-024-PASS.png'),
    fullPage: true
  });

});