import { test, expect, Locator } from '@playwright/test';
import path from 'path';

// Dùng ngày tương lai, không cố định ngày đã khảo sát trong Excel.
function ngaySau(soNgay: number) {
  const homNay = new Date();
  const ngay = new Date();
  ngay.setDate(ngay.getDate() + soNgay);

  return {
    ngay: ngay.getDate(),
    thangLech: (ngay.getFullYear() - homNay.getFullYear()) * 12
      + ngay.getMonth() - homNay.getMonth(),
    hienThi: ngay.toLocaleDateString('vi-VN'),
  };
}

test('TC-BOOK-001 - Chọn số lượng khách trong khoảng cho phép', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);

  const ngayDi = ngaySau(3);
  const ngayVe = ngaySau(5);
  const nhaXe = 'Anh Huy Travel';
  let ketQua = 'FAIL';

  // Đọc đúng bộ đếm khách của chuyến đang mở, không lấy bộ đếm tiện ích.
  const khuVucKhach = () => page.locator('.online-note-selection').filter({ visible: true }).first();
  const boDem = () => khuVucKhach().locator('div[class*="QuantityInput"]').first();
  const nutTang = () => boDem().locator('svg[class*="PlusIcon"]');
  const nutGiam = () => boDem().locator('svg[class*="SubIcon"]');
  const soKhach = async () => Number((await boDem().innerText()).trim());

  // Nhà xe này có luồng chọn số khách. Chọn chuyến đủ chỗ cho mốc cần kiểm tra.
  async function moChuyen(soChoToiThieu: number) {
    const cacNut = page.getByRole('button', { name: 'Chọn chỗ', exact: true });
    await cacNut.first().waitFor({ state: 'visible', timeout: 30000 });

    for (let i = 0; i < await cacNut.count(); i++) {
      const nut = cacNut.nth(i);
      const thongTin = await nut.evaluate(el => {
        let khung = el.parentElement;
        for (let j = 0; j < 15 && khung; j++, khung = khung.parentElement) {
          if (/Còn\s+\d+\s+chỗ trống/.test(khung.innerText)
            && /\d{1,2}:\d{2}/.test(khung.innerText)) return khung.innerText;
        }
        return '';
      });
      const conCho = Number(thongTin.match(/Còn\s+(\d+)\s+chỗ trống/)?.[1] ?? 0);

      if (thongTin.includes(nhaXe) && conCho >= soChoToiThieu) {
        console.log('Chuyến dùng cho TC-BOOK-001:', thongTin);
        await nut.click();
        await expect(khuVucKhach(), 'Chuyến đã chọn phải có mục Số lượng khách')
          .toBeVisible({ timeout: 20000 });
        await expect(boDem()).toBeVisible();
        return;
      }
    }

    test.skip(true, `Không có chuyến ${nhaXe} còn ít nhất ${soChoToiThieu} chỗ trong danh sách đang hiển thị.`);
  }

  // Popup quy định nhà xe có thể xuất hiện sau lần bấm Tiếp tục đầu tiên.
  async function tiepTucChonCho() {
    const nut = page.locator('button.footer-nextstep').filter({ visible: true }).first();
    await nut.click();

    const dongY = page.getByText('Tôi đã đọc và đồng ý', { exact: true });
    const coThongBao = await dongY.waitFor({ state: 'visible', timeout: 2000 })
      .then(() => true, () => false);
    if (coThongBao) {
      await dongY.click();
      await expect(dongY).toBeHidden();
      if (await nut.isVisible()) await nut.click();
    }
  }

  async function chuaBiVoHieu(nut: Locator) {
    return !(await nut.evaluate(el => Boolean(el.closest('[disabled], [aria-disabled="true"]'))));
  }

  // Tổng tiền có hiệu ứng chuyển số: đọc innerText ở footer và chờ đúng giá trị.
  async function tongTienChieu() {
    return page.locator('button.footer-nextstep').filter({ visible: true }).first().evaluate(el => {
      let khung = el.parentElement;
      for (let i = 0; i < 8 && khung; i++, khung = khung.parentElement) {
        const text = khung.innerText;
        // Vé khứ hồi dùng nhãn "Tổng cộng chiều đi/về", số tiền có thể xuống dòng.
        const tong = text.match(/Tổng cộng(?:\s+chiều\s+(?:đi|về))?\s*:\s*([\d.,\s]+)\s*[đ₫]/);
        if (/Ghế\s*:/.test(text) && tong) return Number(tong[1].replace(/\D/g, ''));
      }
      return null;
    });
  }

  try {
    // 1. Chuẩn bị chuyến khứ hồi Hà Nội → Hải Phòng, hôm nay + 3 và + 5 ngày.
    // Đây là tiền điều kiện để đến bước Chọn chỗ chiều về trong Excel.
    await page.addLocatorHandler(
      page.getByRole('dialog').getByRole('button', { name: 'close', exact: true }).first(),
      async nutDong => { await nutDong.click(); },
    );
    await page.goto('https://vexere.com/', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('SearchWidget.from').waitFor({ state: 'visible' });

    await page.getByText('Nơi xuất phát', { exact: true }).click();
    await page.getByTestId('SearchWidget.from').fill('Hà Nội');
    await page.getByRole('paragraph').filter({ hasText: /^Hà Nội$/ }).first().click();
    await page.getByText('Nơi đến', { exact: true }).click();
    await page.getByTestId('SearchWidget.to').fill('Hải Phòng');
    await page.getByRole('paragraph').filter({ hasText: /^Hải Phòng$/ }).first().click();
    await page.locator('li > div > p:first-child', { hasText: new RegExp(`^${ngayDi.ngay}$`) })
      .nth(ngayDi.thangLech).click();
    await page.getByText('Thêm ngày về', { exact: true }).click();
    await page.locator('li > div > p:first-child', { hasText: new RegExp(`^${ngayVe.ngay}$`) })
      .nth(ngayVe.thangLech).click();
    await page.getByTestId('SearchWidget.search').click();
    await expect(page.getByText(/Kết quả chiều đi/).first()).toBeVisible({ timeout: 30000 });

    // 2. Chọn 1 khách chiều đi để chuyển sang danh sách chuyến chiều về.
    await moChuyen(1);
    const khachChieuDi = await soKhach();
    expect(Number.isInteger(khachChieuDi)).toBe(true);
    expect(khachChieuDi).toBeGreaterThanOrEqual(0);
    expect(khachChieuDi).toBeLessThanOrEqual(8);
    for (let i = khachChieuDi; i < 1; i++) await nutTang().click();
    for (let i = khachChieuDi; i > 1; i--) await nutGiam().click();
    await expect(boDem()).toHaveText('1');
    await tiepTucChonCho();

    const ketQuaChieuVe = page.getByText(/Kết quả chiều về/).first();
    const buocDiemDonTra = page.locator('button.footer-nextstep[data-current="1"]')
      .filter({ visible: true }).first();
    await Promise.race([
      ketQuaChieuVe.waitFor({ state: 'visible', timeout: 30000 }),
      buocDiemDonTra.waitFor({ state: 'visible', timeout: 30000 }),
    ]);
    if (!(await ketQuaChieuVe.isVisible())) {
      // Giữ điểm đón/trả mặc định của chiều đi, rồi chuyển sang chọn chiều về.
      await buocDiemDonTra.click();
    }
    await expect(ketQuaChieuVe).toBeVisible({ timeout: 30000 });

    // 3. Mở chuyến chiều về còn ít nhất 8 chỗ, đọc đơn giá đang hiển thị.
    await moChuyen(8);
    console.log(`TC-BOOK-001: ${nhaXe}; Hà Nội ↔ Hải Phòng; ngày đi ${ngayDi.hienThi}; ngày về ${ngayVe.hienThi}; chưa đăng nhập.`);
    const textDonGia = await khuVucKhach().locator('.seat-group-selection').first().innerText();
    const gia = textDonGia.match(/(\d[\d.,]*)\s*đ/);
    expect(gia, 'Phải đọc được đơn giá của nhóm ghế đang kiểm tra').not.toBeNull();
    const donGia = Number(gia![1].replace(/\D/g, ''));
    expect(donGia).toBeGreaterThan(0);

    // Dùng soft assertion để vẫn kiểm tra đủ hai biên nếu mặc định đang là 0.
    // Kỳ vọng giữ nguyên theo Excel: mặc định 1 khách, không chấp nhận dưới 1.
    await expect.soft(boDem(), 'Số khách mặc định phải là 1').toHaveText('1');
    const batDau = await soKhach();
    expect(Number.isInteger(batDau)).toBe(true);
    expect(batDau).toBeGreaterThanOrEqual(0);
    expect(batDau).toBeLessThanOrEqual(8);

    // 4. Tăng đến 8 khách; kiểm tra các mốc BVA 1, 2, 7, 8 và tổng tiền.
    for (let muc = batDau; muc <= 8; muc++) {
      if (muc > batDau) await nutTang().click();
      await expect(boDem()).toHaveText(String(muc));
      if ([1, 2, 7, 8].includes(muc)) {
        await expect.soft.poll(tongTienChieu, `Tổng tiền khi chọn ${muc} khách`)
          .toBe(donGia * muc);
      }
    }

    // 5. Thử khách thứ 9: bộ đếm phải giữ 8 và có thông báo giới hạn/tổng đài.
    if (await chuaBiVoHieu(nutTang())) await nutTang().click();
    await expect.soft(boDem(), 'Không được tăng quá 8 khách').toHaveText('8');
    const popupGioiHan = page.getByRole('dialog')
      .filter({ hasText: /Bạn được chọn tối đa 8 chỗ cho mỗi lần đặt/ })
      .filter({ visible: true }).first();
    await expect.soft(popupGioiHan, 'Phải hiển thị thông báo giới hạn tối đa 8 chỗ').toBeVisible();
    if (await popupGioiHan.isVisible()) {
      // Tổng đài nằm trong nội dung popup, không nằm trong tiêu đề thông báo.
      const noiDung = await popupGioiHan.innerText();
      expect.soft(noiDung, 'Thông báo giới hạn phải kèm số tổng đài').toMatch(/(?:\d[\s().-]*){8,}/);
    }
    await page.screenshot({
      path: path.join(__dirname, `screenshots/TC-BOOK-001-${testInfo.project.name}-MAX-8.png`),
      fullPage: true,
    });

    // Lưu bằng chứng trước, rồi đóng popup để nó không chặn nút giảm khách.
    if (await popupGioiHan.isVisible()) {
      await popupGioiHan.getByText('Đã hiểu', { exact: true }).click();
      await expect(popupGioiHan).toBeHidden();
    }

    // 6. Giảm về 1, thử giảm thêm để kiểm tra mốc 0 bị chặn.
    const truocKhiGiam = await soKhach();
    expect(truocKhiGiam).toBeLessThanOrEqual(9);
    for (let muc = truocKhiGiam; muc > 1; muc--) {
      await nutGiam().click();
      await expect(boDem()).toHaveText(String(muc - 1));
    }

    // Kiểm tra tổng tiền ngay tại mốc hợp lệ 1 khách, trước khi thử xuống 0.
    await expect(boDem(), 'Phải về đúng 1 khách trước khi thử giảm dưới biên').toHaveText('1');
    await expect.soft.poll(tongTienChieu, 'Tổng tiền khi còn 1 khách phải bằng đơn giá').toBe(donGia);

    if (await chuaBiVoHieu(nutGiam())) await nutGiam().click();
    await expect.soft(boDem(), 'Không được giảm xuống 0 khách').toHaveText('1');
    console.log('Kết quả thử giảm dưới biên:', {
      soKhachMongDoi: 1,
      soKhachThucTe: await soKhach(),
      tongTienThucTe: await tongTienChieu(),
    });

    ketQua = testInfo.errors.length === 0 ? 'PASS' : 'FAIL';
  } catch (error) {
    ketQua = testInfo.expectedStatus === 'skipped' && testInfo.errors.length === 0 ? 'SKIP' : 'FAIL';
    throw error;
  } finally {
    // 7. Chụp ảnh cuối theo kết quả thật; soft assertion thất bại vẫn là FAIL.
    if (!page.isClosed()) {
      await page.screenshot({
        path: path.join(__dirname, `screenshots/TC-BOOK-001-${testInfo.project.name}-${ketQua}.png`),
        fullPage: true,
      });
    }
  }
});
