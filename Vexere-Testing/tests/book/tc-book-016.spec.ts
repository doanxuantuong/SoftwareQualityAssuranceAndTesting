import { test, expect, Locator } from '@playwright/test';
import path from 'path';

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

test('TC-BOOK-016 - Chính sách giá chọn độc lập giữa Chiều đi và Chiều về', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);

  const ngayDi = ngaySau(3);
  const ngayVe = ngaySau(5);
  const nhaXe = 'Anh Huy Travel';
  const thoiDiemChay = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });
  const kiemTraMem = expect.configure({ soft: true });
  const cacKiemTra: object[] = [];
  const cacChuyen: object[] = [];
  let giaHaiChieu: object | null = null;
  let ketQua = 'FAIL';
  const anh = (ten: string) => path.join(__dirname,
    'screenshots/TC-BOOK-016-' + testInfo.project.name + '-' + ten + '.png');

  const khungDatVe = () => page.getByRole('button', { name: 'Đóng', exact: true })
    .filter({ visible: true }).first()
    .locator('xpath=ancestor::div[.//button[contains(@class,"footer-nextstep")]][1]');
  const khuVucKhach = () => khungDatVe().locator('.online-note-selection').filter({ visible: true }).first();
  const boDem = () => khuVucKhach().locator('div[class*="QuantityInput"]').first();
  const nutBuoc = (buoc: number) => khungDatVe()
    .locator('button.footer-nextstep[data-current="' + buoc + '"]').filter({ visible: true }).first();

  async function bamVaDongQuyDinh(nut: Locator, dich: Locator) {
    await nut.click();
    const dongY = page.getByText('Tôi đã đọc và đồng ý', { exact: true }).filter({ visible: true }).first();
    await expect(dich.or(dongY).filter({ visible: true }).first()).toBeVisible({ timeout: 30000 });
    if (await dongY.isVisible()) {
      await dongY.click();
      await expect(dongY).toBeHidden();
      if (!(await dich.isVisible()) && await nut.isVisible()) await nut.click();
    }
    await expect(dich).toBeVisible({ timeout: 30000 });
  }

  async function chonDiemConThieu() {
    for (const ten of ['Điểm đón', 'Điểm trả']) {
      const cacNhan = khungDatVe().getByText(ten, { exact: true }).filter({ visible: true });
      expect(await cacNhan.count(), 'Phải có nhóm ' + ten).toBeGreaterThan(0);
      for (let i = 0; i < await cacNhan.count(); i++) {
        const nhom = cacNhan.nth(i)
          .locator('xpath=ancestor::div[.//input[@type="radio"] or .//*[@role="radio"]][1]');
        await expect(nhom.getByRole('radio').first()).toBeVisible();
        if (await nhom.getByRole('radio', { checked: true }).count() === 0) {
          await nhom.getByRole('radio').first().check();
        }
        await expect(nhom.getByRole('radio', { checked: true })).toHaveCount(1);
      }
    }
  }

  async function moChuyenMotKhach(tenChieu: string) {
    const cacNut = page.getByRole('button', { name: 'Chọn chỗ', exact: true }).filter({ visible: true });
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
      if (thongTin.includes(nhaXe) && conCho > 0) {
        await nut.click();
        await expect(boDem()).toBeVisible({ timeout: 20000 });
        const banDau = Number((await boDem().innerText()).trim());
        expect(Number.isInteger(banDau)).toBe(true);
        expect(banDau).toBeGreaterThanOrEqual(0);
        expect(banDau).toBeLessThanOrEqual(8);
        for (let n = banDau; n < 1; n++) {
          await boDem().locator('svg[class*="PlusIcon"]').click();
          await expect(boDem()).toHaveText(String(n + 1));
        }
        for (let n = banDau; n > 1; n--) {
          await boDem().locator('svg[class*="SubIcon"]').click();
          await expect(boDem()).toHaveText(String(n - 1));
        }
        await expect(boDem()).toHaveText('1');
        cacChuyen.push({ chieu: tenChieu, soKhach: 1, thongTin });
        console.log('TC-BOOK-016 - Chuyến ' + tenChieu + ':', thongTin);
        return;
      }
    }
    test.skip(true, 'Thiếu dữ liệu: không thấy chuyến ' + nhaXe + ' ' + tenChieu + ' còn chỗ.');
  }

  const khungChinhSach = () => page.getByText('Chính sách hủy', { exact: true })
    .locator('xpath=ancestor::div[.//*[normalize-space(.)="Giá khuyến mãi"] and .//*[normalize-space(.)="Giá gốc"]][1]');
  const theGia = (ten: 'Giá khuyến mãi' | 'Giá gốc') => khungChinhSach()
    .getByText(ten, { exact: true }).filter({ visible: true })
    .locator('xpath=ancestor::div[.//button][1]');
  const dauChon = (ten: 'Giá khuyến mãi' | 'Giá gốc') =>
    theGia(ten).getByRole('img', { name: 'checked', exact: true });

  async function chuyenTab(ten: 'Chiều đi' | 'Chiều về') {
    const tab = khungChinhSach().getByText(ten, { exact: true }).filter({ visible: true });
    await expect(tab).toHaveCount(1);
    await tab.click();
    await expect(theGia('Giá khuyến mãi')).toBeVisible();
    await expect(theGia('Giá gốc')).toBeVisible();
  }

  async function docGiaHienThi() {
    const docGia = async (ten: 'Giá khuyến mãi' | 'Giá gốc') => {
      const text = await theGia(ten).innerText();
      // Thẻ KM có thể kèm giá gốc gạch ngang: giá đầu tiên mới là giá đang chào bán.
      const gia = text.match(/(\d[\d.,]*)\s*[đ₫]/)?.[1];
      expect(gia, 'Phải đọc được ' + ten).toBeTruthy();
      const soTien = Number(gia!.replace(/\D/g, ''));
      expect(soTien).toBeGreaterThan(0);
      return soTien;
    };
    return { khuyenMai: await docGia('Giá khuyến mãi'), giaGoc: await docGia('Giá gốc') };
  }

  async function docTamTinh() {
    const nhan = page.getByText('Tạm tính', { exact: true }).filter({ visible: true });
    await expect(nhan).toHaveCount(1);
    return nhan.evaluate(el => {
      let khung: HTMLElement | null = el as HTMLElement;
      for (let i = 0; i < 8 && khung; i++, khung = khung.parentElement) {
        const text = khung.innerText;
        const viTri = text.indexOf('Tạm tính');
        if (viTri < 0) continue;
        const gia = text.slice(viTri + 'Tạm tính'.length).match(/^\s*:?\s*(\d[\d.,\s]*)\s*[đ₫]/);
        if (gia) return Number(gia[1].replace(/\D/g, ''));
      }
      return null;
    });
  }

  async function chonGia(ten: 'Giá khuyến mãi' | 'Giá gốc') {
    await expect(theGia(ten)).toBeVisible();
    await theGia(ten).click();
    await expect(dauChon(ten), 'Phải đánh dấu đúng chính sách vừa chọn').toHaveCount(1);
    const tenConLai = ten === 'Giá gốc' ? 'Giá khuyến mãi' : 'Giá gốc';
    await expect(dauChon(tenConLai)).toHaveCount(0);
  }

  async function kiemTraTrangThai(duLieu: {
    buoc: string; chieu: 'Chiều đi' | 'Chiều về'; luaChon: 'Giá khuyến mãi' | 'Giá gốc';
    giaDaGhi: { khuyenMai: number; giaGoc: number }; tongMongDoi: number;
  }) {
    await chuyenTab(duLieu.chieu);
    const soLoiTruoc = testInfo.errors.length;
    await kiemTraMem(dauChon(duLieu.luaChon),
      duLieu.chieu + ': phải giữ ' + duLieu.luaChon).toHaveCount(1);
    const tenConLai = duLieu.luaChon === 'Giá gốc' ? 'Giá khuyến mãi' : 'Giá gốc';
    await kiemTraMem(dauChon(tenConLai)).toHaveCount(0);
    const giaHienThi = await docGiaHienThi();
    await kiemTraMem(giaHienThi, duLieu.chieu + ': giữ đúng giá của chiều đang xem')
      .toEqual(duLieu.giaDaGhi);
    await kiemTraMem.poll(docTamTinh,
      duLieu.buoc + ': Tạm tính phải khớp tổng lựa chọn của hai chiều').toBe(duLieu.tongMongDoi);
    const trangThai = testInfo.errors.length === soLoiTruoc ? 'PASS' : 'FAIL';
    const quanSat = { ...duLieu, trangThai, giaHienThi,
      luaChonThucTe: await dauChon('Giá gốc').count() === 1 ? 'Giá gốc'
        : await dauChon('Giá khuyến mãi').count() === 1 ? 'Giá khuyến mãi' : 'Không xác định',
      tamTinhThucTe: await docTamTinh() };
    cacKiemTra.push(quanSat);
    console.log('TC-BOOK-016 - Đối chiếu:', quanSat);
    await page.screenshot({ path: anh(duLieu.buoc + '-' + trangThai), fullPage: true });
  }

  try {
    // 1. Chuẩn bị khứ hồi, mỗi chiều 1 khách để đọc và đối chiếu chính sách giá độc lập.
    await page.addLocatorHandler(
      page.getByRole('dialog').filter({ hasText: /Sử dụng cookie/ })
        .getByRole('button', { name: 'close', exact: true }).first(),
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
    await page.locator('li > div > p:first-child', { hasText: new RegExp('^' + ngayDi.ngay + '$') })
      .nth(ngayDi.thangLech).click();
    await page.getByText('Thêm ngày về', { exact: true }).click();
    await page.locator('li > div > p:first-child', { hasText: new RegExp('^' + ngayVe.ngay + '$') })
      .nth(ngayVe.thangLech).click();
    await page.getByTestId('SearchWidget.search').click();
    await expect(page.getByText(/Kết quả chiều đi/).first()).toBeVisible({ timeout: 30000 });

    await moChuyenMotKhach('Chiều đi');
    const ketQuaVe = page.getByText(/Kết quả chiều về/).first();
    const diemDonTra = nutBuoc(1);
    await bamVaDongQuyDinh(nutBuoc(0), ketQuaVe.or(diemDonTra).filter({ visible: true }).first());
    if (!(await ketQuaVe.isVisible())) {
      await chonDiemConThieu();
      await bamVaDongQuyDinh(diemDonTra, ketQuaVe);
    }
    await expect(ketQuaVe).toBeVisible({ timeout: 30000 });
    await moChuyenMotKhach('Chiều về');
    const hoTen = page.locator('#userName');
    await bamVaDongQuyDinh(nutBuoc(0), diemDonTra.or(hoTen).filter({ visible: true }).first());
    if (!(await hoTen.isVisible())) {
      await chonDiemConThieu();
      await bamVaDongQuyDinh(diemDonTra, hoTen);
    }
    await expect(page).toHaveURL(/\/bookingconfirmation(?:[/?#]|$)/, { timeout: 30000 });
    await expect(khungChinhSach()).toBeVisible();
    console.log('TC-BOOK-016 - Điều kiện chạy:', { nhaXe, ngayDi: ngayDi.hienThi,
      ngayVe: ngayVe.hienThi, tuyen: 'Hà Nội ↔ Hải Phòng', soKhachMoiChieu: 1,
      dangNhap: false, thoiDiemChay });

    // 2. Đưa cả hai chiều về Giá KM, ghi đúng hai mức giá đang hiển thị của từng chiều.
    await chuyenTab('Chiều đi');
    const giaDi = await docGiaHienThi();
    await chonGia('Giá khuyến mãi');
    await chuyenTab('Chiều về');
    const giaVe = await docGiaHienThi();
    await chonGia('Giá khuyến mãi');
    giaHaiChieu = { giaDi, giaVe };
    const tongHaiKm = giaDi.khuyenMai + giaVe.khuyenMai;
    await kiemTraTrangThai({ buoc: 'BASELINE-RETURN-KM', chieu: 'Chiều về',
      luaChon: 'Giá khuyến mãi', giaDaGhi: giaVe, tongMongDoi: tongHaiKm });
    await kiemTraTrangThai({ buoc: 'BASELINE-GO-KM', chieu: 'Chiều đi',
      luaChon: 'Giá khuyến mãi', giaDaGhi: giaDi, tongMongDoi: tongHaiKm });

    // 3. Theo G12: đổi chiều về sang Giá gốc, chiều đi phải vẫn giữ Giá KM.
    await chuyenTab('Chiều về');
    await chonGia('Giá gốc');
    const tongVeGoc = giaDi.khuyenMai + giaVe.giaGoc;
    await kiemTraTrangThai({ buoc: 'RETURN-ORIGINAL', chieu: 'Chiều về',
      luaChon: 'Giá gốc', giaDaGhi: giaVe, tongMongDoi: tongVeGoc });
    await kiemTraTrangThai({ buoc: 'GO-UNCHANGED-KM', chieu: 'Chiều đi',
      luaChon: 'Giá khuyến mãi', giaDaGhi: giaDi, tongMongDoi: tongVeGoc });

    // 4. Đổi chiều đi sang Giá gốc; chuyển về tab chiều về phải vẫn giữ Giá gốc đã chọn.
    await chonGia('Giá gốc');
    const tongHaiGoc = giaDi.giaGoc + giaVe.giaGoc;
    await kiemTraTrangThai({ buoc: 'GO-ORIGINAL', chieu: 'Chiều đi',
      luaChon: 'Giá gốc', giaDaGhi: giaDi, tongMongDoi: tongHaiGoc });
    await kiemTraTrangThai({ buoc: 'RETURN-UNCHANGED-ORIGINAL', chieu: 'Chiều về',
      luaChon: 'Giá gốc', giaDaGhi: giaVe, tongMongDoi: tongHaiGoc });

    // 5. Chuyển tab thêm lần nữa để xác nhận lựa chọn được giữ, không đổi Tạm tính.
    await kiemTraTrangThai({ buoc: 'GO-REVISIT-ORIGINAL', chieu: 'Chiều đi',
      luaChon: 'Giá gốc', giaDaGhi: giaDi, tongMongDoi: tongHaiGoc });
    await kiemTraTrangThai({ buoc: 'RETURN-REVISIT-ORIGINAL', chieu: 'Chiều về',
      luaChon: 'Giá gốc', giaDaGhi: giaVe, tongMongDoi: tongHaiGoc });

    // Không kiểm tra lại các case DT007 riêng hoặc cố định điều kiện hủy phụ thuộc thời điểm.
    // TC016 dừng tại chính sách giá ở trang liên hệ, không sang thanh toán.
    ketQua = testInfo.errors.length === 0 ? 'PASS' : 'FAIL';
    console.log('TC-BOOK-016 - Kết quả automation:', ketQua);
  } catch (error) {
    ketQua = testInfo.expectedStatus === 'skipped' && testInfo.errors.length === 0 ? 'SKIP' : 'FAIL';
    throw error;
  } finally {
    await testInfo.attach('TC-BOOK-016-ket-qua', {
      body: Buffer.from(JSON.stringify({ ketQuaAutomation: ketQua, nhaXe, thoiDiemChay,
        ngayDi: ngayDi.hienThi, ngayVe: ngayVe.hienThi, dangNhap: false,
        cacChuyen, giaHaiChieu, cacKiemTra }, null, 2), 'utf8'),
      contentType: 'application/json',
    });
    if (!page.isClosed()) await page.screenshot({ path: anh(ketQua), fullPage: true });
  }
});
