import { test, expect, Page } from '@playwright/test';
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
// Lấy thông tin các chuyến đầu tiên: đi lên từ nút "Chọn chỗ"/"Gọi đặt vé" đến thẻ chứa giờ và giá
async function layChuyen(page: Page, toiDa = 10) {
  const nut = page.getByText(/^(Chọn chỗ|Gọi đặt vé)$/);
  await nut.first().waitFor({ state: 'visible', timeout: 20000 });
  const n = Math.min(await nut.count(), toiDa);
  const ds: { text: string; nhaXe: string; gio: number | null; gia: number | null; danhGia: number | null }[] = [];
  for (let i = 0; i < n; i++) {
    const text = await nut.nth(i).evaluate(el => {
      let p: HTMLElement | null = el as HTMLElement;
      for (let k = 0; k < 15 && p; k++) {
        p = p.parentElement;
        if (p && /\d{1,2}:\d{2}/.test(p.innerText) && /\d[\d.]*\s*đ/.test(p.innerText)) return p.innerText;
      }
      return '';
    });
    const g = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const gia = [...text.matchAll(/(\d{1,3}(?:\.\d{3})+)\s*đ/g)].map(m => Number(m[1].replace(/\./g, '')));
    const dg = text.match(/(\d(?:\.\d)?)\s*\(\s*[\d.,]+\s*\)/);
    ds.push({
      text,
      nhaXe: text.split('\n').map(s => s.trim()).filter(Boolean)[0] ?? '',
      gio: g ? Number(g[1]) * 60 + Number(g[2]) : null,
      gia: gia.length ? Math.min(...gia) : null,
      danhGia: dg ? Number(dg[1]) : null,
    });
  }
  return ds;
}

test('TC-SEARCH-026 - Sắp xếp kết quả theo giá, giờ đi và đánh giá', async ({ page }) => {
  const ngay = ngayTu(1);
  const khongGiam = (a: (number | null)[]) => a.every((v, i) => i === 0 || v === null || a[i - 1] === null || v >= a[i - 1]!);
  const khongTang = (a: (number | null)[]) => a.every((v, i) => i === 0 || v === null || a[i - 1] === null || v <= a[i - 1]!);

  // Chọn tùy chọn sắp xếp, kiểm tra số chuyến không đổi, trả về 10 chuyến đầu
  const sapXep = async (tuyChon: string) => {
    await page.getByText(tuyChon, { exact: true }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText(new RegExp(`Kết quả[^:\\n]*:\\s*${tong}\\s*chuyến`)).first()).toBeVisible();
    return layChuyen(page, 10);
  };
  let tong = 0;

  // 1. Truy cập website Vexere
  await page.goto('https://vexere.com/');

  // 2. Đóng popup nếu xuất hiện
  const closeButton = page.getByRole('button', { name: 'close' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }

  // 3. Tìm Sài Gòn → Nha Trang - Khánh Hòa, hôm nay + 1; ghi lại "Kết quả"
  await page.getByText('Nơi xuất phát').click();
  await page.getByTestId('SearchWidget.from').click();
  await page.getByRole('paragraph').filter({ hasText: /^Hồ Chí Minh$/ }).click();
  await page.getByText('Nơi đến').click();
  await page.getByTestId('SearchWidget.to').fill('Nha Trang');
  await page.getByRole('paragraph').filter({ hasText: /^Nha Trang - Khánh Hòa$/ }).first().click();
  await page
    .locator('li > div > p:first-child', { hasText: new RegExp(`^${ngay.ngay}$`) })
    .nth(ngay.thangLech)
    .click();
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/', { timeout: 20000 }),
    page.getByTestId('SearchWidget.search').click(),
  ]);
  const tieuDe = page.getByText(/Kết quả[^:\n]*:\s*(\d+)\s*chuyến/).first();
  await expect(tieuDe).toBeVisible({ timeout: 20000 });
  tong = Number((await tieuDe.innerText()).match(/\d+/)![0]);

  // 4. Giá tăng dần / giảm dần (10 chuyến đầu)
  expect(khongGiam((await sapXep('Giá tăng dần')).map(c => c.gia))).toBe(true);
  expect(khongTang((await sapXep('Giá giảm dần')).map(c => c.gia))).toBe(true);

  // 5. Giờ đi sớm nhất / muộn nhất
  expect(khongGiam((await sapXep('Giờ đi sớm nhất')).map(c => c.gio))).toBe(true);
  expect(khongTang((await sapXep('Giờ đi muộn nhất')).map(c => c.gio))).toBe(true);

  // 6. Đánh giá cao nhất
  expect(khongTang((await sapXep('Đánh giá cao nhất')).map(c => c.danhGia))).toBe(true);
  // (Cần xác nhận giá dùng để sắp xếp là giá sau khuyến mãi hay giá gốc; test lấy giá thấp nhất trên thẻ)

  // 7. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-026-PASS.png'),
    fullPage: true
  });

});
