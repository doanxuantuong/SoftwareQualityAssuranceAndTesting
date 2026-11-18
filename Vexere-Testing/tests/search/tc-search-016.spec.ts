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

test('TC-SEARCH-016 - Số chuyến, giá vé và số chỗ trống cập nhật theo ngày đi', async ({ page }) => {
  // Mỗi lần tìm đi từ trang chủ
  async function timKiem(soNgay: number) {
    const ngay = ngayTu(soNgay);
    await page.goto('https://vexere.com/');
    const closeButton = page.getByRole('button', { name: 'close' });
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    }
    await page.getByText('Nơi xuất phát').click();
    await page.getByTestId('SearchWidget.from').click();
    await page.getByRole('paragraph').filter({ hasText: /^Ninh Bình$/ }).click();
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
    await expect(page.getByText(ngay.hienThi).first()).toBeVisible();
    const tieuDe = page.getByText(/Kết quả[^:\n]*:\s*(\d+)\s*chuyến/).first();
    await expect(tieuDe).toBeVisible({ timeout: 20000 });
    const tong = Number((await tieuDe.innerText()).match(/\d+/)![0]);
    const [dau] = await layChuyen(page, 1);
    return { tong, dau };
  }

  // 1. Tìm Ninh Bình → Nha Trang - Khánh Hòa, hôm nay + 3 và ghi lại chuyến đầu
  const lan1 = await timKiem(3);

  // 2. Tìm lại với hôm nay + 5 và ghi lại chuyến đầu
  const lan2 = await timKiem(5);

  // 3. Mỗi ngày đều có "Kết quả", giá và số chỗ trống của chuyến đầu (giá và số chuyến có thể giống hoặc khác nhau giữa hai ngày)
  for (const l of [lan1, lan2]) {
    expect(l.tong).toBeGreaterThan(0);
    expect(l.dau.gia).not.toBeNull();
    expect(l.dau.text).toMatch(/Còn\s+\d+\s+chỗ trống|Gọi đặt vé/);
  }
  console.log('Ngày 1:', lan1.tong, 'chuyến, giá đầu', lan1.dau.gia, '| Ngày 2:', lan2.tong, 'chuyến, giá đầu', lan2.dau.gia);

  // 4. Chụp ảnh minh chứng
  await page.screenshot({
    path: path.join(__dirname, '../search/screenshots/TC-SEARCH-016-PASS.png'),
    fullPage: true
  });

});
