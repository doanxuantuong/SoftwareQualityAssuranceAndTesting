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

test('TC-BOOK-018 - Số khách khác nhau giữa chiều đi và chiều về', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);

  const ngayDi = ngaySau(3);
  const ngayVe = ngaySau(5);
  const nhaXe = 'Anh Huy Travel';
  const thoiDiemChay = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });
  const kiemTraMem = expect.configure({ soft: true });
  const cacKiemTra: object[] = [];
  const cacChieu: Array<{
    ten: string; soKhach: number; donGia: number; tongMongDoi: number;
    tongThucTe: number | null; thongTinChuyen: string;
  }> = [];
  let doiChieuTong: object = { trangThai: 'NOT RUN' };
  let ketQua = 'FAIL';
  const anh = (ten: string) => path.join(__dirname,
    'screenshots/TC-BOOK-018-' + testInfo.project.name + '-' + ten + '.png');

  const khungDatVe = () => page.getByRole('button', { name: 'Đóng', exact: true })
    .filter({ visible: true }).first()
    .locator('xpath=ancestor::div[.//button[contains(@class,"footer-nextstep")]][1]');
  const khuVucKhach = () => khungDatVe().locator('.online-note-selection').filter({ visible: true }).first();
  const boDem = () => khuVucKhach().locator('div[class*="QuantityInput"]').first();
  const nutTang = () => boDem().locator('svg[class*="PlusIcon"]');
  const nutGiam = () => boDem().locator('svg[class*="SubIcon"]');
  const nutBuoc = (buoc: number) => khungDatVe()
    .locator('button.footer-nextstep[data-current="' + buoc + '"]').filter({ visible: true }).first();

  async function bamVaDongQuyDinh(nut: Locator, dich: Locator) {
    await nut.click();
    const dongY = page.getByText('Tôi đã đọc và đồng ý', { exact: true })
      .filter({ visible: true }).first();
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
      expect(await cacNhan.count(), 'Phải có nhóm ' + ten + ' trong bước chọn điểm').toBeGreaterThan(0);
      for (let i = 0; i < await cacNhan.count(); i++) {
        const nhom = cacNhan.nth(i)
          .locator('xpath=ancestor::div[.//input[@type="radio"] or .//*[@role="radio"]][1]');
        const cacRadio = nhom.getByRole('radio');
        await expect(cacRadio.first()).toBeVisible();
        if (await nhom.getByRole('radio', { checked: true }).count() === 0) await cacRadio.first().check();
        await expect(nhom.getByRole('radio', { checked: true })).toHaveCount(1);
      }
    }
  }

  async function moChuyen(tenChieu: string, soChoCan: number) {
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
      if (thongTin.includes(nhaXe) && conCho >= soChoCan) {
        await nut.click();
        await expect(boDem()).toBeVisible({ timeout: 20000 });
        console.log('TC-BOOK-018 - Chuyến ' + tenChieu + ':', thongTin);
        return thongTin;
      }
    }
    const lyDoThieuDuLieu = 'Thiếu dữ liệu: không có chuyến ' + nhaXe + ' ' + tenChieu
      + ' còn ít nhất ' + soChoCan + ' chỗ trong danh sách đang hiển thị.';
    // Không để trạng thái skip che các lỗi đã quan sát ở chiều trước.
    if (testInfo.errors.length > 0) throw new Error(lyDoThieuDuLieu + ' Trước đó đã có kiểm tra FAIL.');
    test.skip(true, lyDoThieuDuLieu);
    throw new Error('Không có chuyến để chuẩn bị TC018.');
  }

  async function datSoKhach(muc: number) {
    const batDau = Number((await boDem().innerText()).trim());
    expect(Number.isInteger(batDau), 'Phải đọc được số khách hiện tại').toBe(true);
    expect(batDau).toBeGreaterThanOrEqual(0);
    expect(batDau).toBeLessThanOrEqual(8);
    for (let n = batDau; n < muc; n++) {
      await nutTang().click();
      await expect(boDem()).toHaveText(String(n + 1));
    }
    for (let n = batDau; n > muc; n--) {
      await nutGiam().click();
      await expect(boDem()).toHaveText(String(n - 1));
    }
    await expect(boDem()).toHaveText(String(muc));
  }

  async function docFooterChieu() {
    return nutBuoc(0).evaluate(el => {
      let khung = el.parentElement;
      for (let i = 0; i < 8 && khung; i++, khung = khung.parentElement) {
        const text = khung.innerText;
        const ghe = text.match(/Ghế\s*:\s*(\d+)\s*Khách/i);
        const tong = text.match(/Tổng cộng(?:\s+chiều\s+(?:đi|về))?\s*:\s*([\d.,\s]+)\s*[đ₫]/i);
        if (ghe && tong) return { soKhach: Number(ghe[1]),
          tongTien: Number(tong[1].replace(/\D/g, '')), text };
      }
      return { soKhach: null, tongTien: null, text: '' };
    });
  }

  async function docTienTheoNhan(nhan: Locator) {
    return nhan.evaluate(el => {
      const tenNhan = (el.textContent || '').trim();
      let khung: HTMLElement | null = el as HTMLElement;
      let text = '';
      for (let i = 0; i < 8 && khung; i++, khung = khung.parentElement) {
        text = khung.innerText;
        const viTri = text.indexOf(tenNhan);
        if (viTri < 0) continue;
        const gia = text.slice(viTri + tenNhan.length).match(/^\s*:?\s*(\d[\d.,\s]*)\s*[đ₫]/);
        if (gia) {
          const soTien = Number(gia[1].replace(/\D/g, ''));
          if (Number.isSafeInteger(soTien)) return { soTien, text };
        }
      }
      return { soTien: null, text };
    });
  }

  async function docChiTietChieu(khung: Locator, chieu: 'đi' | 'về') {
    return khung.evaluate((container, tenChieu) => {
      const mau = new RegExp('chiều\\s+' + tenChieu, 'i');
      const mauKhac = new RegExp('chiều\\s+' + (tenChieu === 'đi' ? 'về' : 'đi'), 'i');
      const textCua = (node: Element) => (node as HTMLElement).innerText || '';
      const cacNhan = Array.from(container.querySelectorAll('*')).filter(node =>
        mau.test(textCua(node)) && !Array.from(node.children).some(con => mau.test(textCua(con))));
      if (cacNhan.length !== 1) return { tongTien: null,
        text: (container as HTMLElement).innerText, lyDo: 'Không xác định duy nhất nhãn chiều ' + tenChieu };
      let hang = cacNhan[0] as HTMLElement;
      // Lấy khối riêng của chiều này, dừng trước khối chứa cả hai chiều.
      while (hang.parentElement && hang.parentElement !== container
        && container.contains(hang.parentElement) && !mauKhac.test(hang.parentElement.innerText)) {
        hang = hang.parentElement;
      }
      const text = hang.innerText;
      const cacGia = Array.from(text.matchAll(/(\d[\d.,\s]*)\s*[đ₫]/g));
      const cacTong = cacGia.filter(gia => {
        const truoc = text.slice(0, gia.index);
        const sau = text.slice((gia.index || 0) + gia[0].length);
        return !/\d+\s*(?:(?:vé|khách|chỗ)\s*)?[x×]\s*$/i.test(truoc)
          && !/^\s*[x×]\s*\d+/i.test(sau) && !/^\s*\/\s*(?:khách|vé)/i.test(sau);
      }).map(gia => Number(gia[1].replace(/\D/g, '')));
      const cacGiaTri = Array.from(new Set(cacTong));
      return { tongTien: cacGiaTri.length === 1 ? cacGiaTri[0] : null, text,
        lyDo: cacGiaTri.length === 1 ? '' : 'Không đọc được duy nhất tổng tiền của chiều này' };
    }, chieu);
  }


  async function chonChieu(ten: string, ma: string, soKhach: number) {
    const thongTinChuyen = await moChuyen(ten, soKhach);
    const textGia = await khuVucKhach().locator('.seat-group-selection').first().innerText();
    const gia = textGia.match(/(\d[\d.,]*)\s*[đ₫]/)?.[1];
    expect(gia, ten + ': phải đọc được đơn giá đang hiển thị').toBeTruthy();
    const donGia = Number(gia!.replace(/\D/g, ''));
    expect(donGia).toBeGreaterThan(0);
    // Mặc định 0/1 và biên 1–8 đã thuộc TC001; ở đây chỉ đặt đúng dữ liệu 2/1.
    await datSoKhach(soKhach);
    const tongMongDoi = donGia * soKhach;
    await kiemTraMem.poll(async () => (await docFooterChieu()).soKhach,
      ten + ': footer phải giữ đúng số khách đã chọn').toBe(soKhach);
    await kiemTraMem.poll(async () => (await docFooterChieu()).tongTien,
      ten + ': tổng tiền phải bằng đơn giá × số khách').toBe(tongMongDoi);
    const footer = await docFooterChieu();
    const chieu = { ten, soKhach, donGia, tongMongDoi,
      tongThucTe: footer.tongTien, thongTinChuyen };
    cacChieu.push(chieu);
    console.log('TC-BOOK-018 - Chọn số khách:', chieu);
    await page.screenshot({ path: anh(ma + '-SELECTED'), fullPage: true });
    return chieu;
  }

  const theChuyen = (chieu: 'Chiều đi' | 'Chiều về') =>
    page.getByText(new RegExp('^' + chieu + '$', 'i')).filter({ visible: true }).locator(
      'xpath=ancestor::div[count(.//*[normalize-space(.)="Thay đổi" '
      + 'and not(.//*[normalize-space(.)="Thay đổi"])])=2][1]',
    );

  async function docSoKhachTrenThe(the: Locator) {
    const bieuTuong = the.getByRole('img', { name: /^vex-person-gray(?:-\d+)?$/ });
    await expect(bieuTuong, 'Thẻ chuyến phải có biểu tượng số khách riêng').toHaveCount(1);
    return bieuTuong.evaluate(el => {
      let khung = el.parentElement;
      for (let i = 0; i < 5 && khung; i++, khung = khung.parentElement) {
        const text = khung.innerText.trim();
        if (/^\d+$/.test(text)) return Number(text);
        const cacNhan = Array.from(khung.querySelectorAll('p, span'))
          .filter(node => node.children.length === 0)
          .map(node => (node.textContent || '').trim());
        const soKhach = cacNhan.find(t => /^[1-8]$/.test(t));
        if (soKhach) return Number(soKhach);
      }
      return null;
    });
  }

  function docSoKhachVaGheChiTiet(text: string) {
    // Ví dụ: Giá 150.000đ x 2; Ghế/giường 8,1.
    const soKhach = text.match(/[đ₫]\s*[x×]\s*(\d+)/i)?.[1]
      ?? text.match(/(?:^|\n)\s*(\d+)\s*[x×]\s*\d[\d.,]*\s*[đ₫]/i)?.[1];
    const ghe = text.match(/Ghế\s*\/\s*giường\s*:?\s*([^\n]+)/i)?.[1]?.trim() ?? null;
    return { soKhach: soKhach ? Number(soKhach) : null, ghe };
  }

  try {
    // 1. Chuẩn bị khứ hồi Hà Nội ↔ Hải Phòng, chuẩn bị 2 khách đi và 1 khách về.
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
    console.log('TC-BOOK-018:', { nhaXe, tuyen: 'Hà Nội ↔ Hải Phòng',
      ngayDi: ngayDi.hienThi, ngayVe: ngayVe.hienThi, dangNhap: false });


    console.log('TC-BOOK-018 - Dữ liệu thực hiện:', { nhaXe,
      tuyen: 'Hà Nội ↔ Hải Phòng', ngayDi: ngayDi.hienThi, ngayVe: ngayVe.hienThi,
      dangNhap: false, thoiDiemChay,
      ghiChu: 'Dùng dữ liệu tương đương 2 khách đi/1 khách về trên chuyến hiện có. '
        + 'Excel H14 dùng ghế 9,10 và 8 của Ngọc Phát Limousine 68; ghi lại ghế thực tế, '
        + 'không yêu cầu giá hiện tại phải bằng 510.000đ của lần khảo sát cũ.' });

    // 2. Chọn 2 khách chiều đi và hoàn thành các bước của chiều đi.
    const chieuDi = await chonChieu('Chiều đi', 'GO', 2);
    const ketQuaVe = page.getByText(/Kết quả chiều về/).first();
    const diemDonTra = nutBuoc(1);
    await bamVaDongQuyDinh(nutBuoc(0), ketQuaVe.or(diemDonTra).filter({ visible: true }).first());
    if (!(await ketQuaVe.isVisible())) {
      await chonDiemConThieu();
      await bamVaDongQuyDinh(diemDonTra, ketQuaVe);
    }
    await expect(ketQuaVe).toBeVisible({ timeout: 30000 });

    // 3. Chọn riêng 1 khách chiều về, không đồng bộ số khách về thành 2.
    const chieuVe = await chonChieu('Chiều về', 'RETURN', 1);
    const hoTen = page.locator('#userName');
    await bamVaDongQuyDinh(nutBuoc(0), diemDonTra.or(hoTen).filter({ visible: true }).first());
    if (!(await hoTen.isVisible())) {
      await chonDiemConThieu();
      await bamVaDongQuyDinh(diemDonTra, hoTen);
    }
    await expect(page).toHaveURL(/\/bookingconfirmation(?:[/?#]|$)/, { timeout: 30000 });
    await expect(hoTen).toBeVisible();

    // 4. Đối chiếu hai thẻ riêng: chọn 1 khách về không làm mất 2 khách đi.
    for (const duLieu of [
      { ten: 'Chiều đi' as const, soKhach: 2 },
      { ten: 'Chiều về' as const, soKhach: 1 },
    ]) {
      const the = theChuyen(duLieu.ten);
      await expect(the).toHaveCount(1);
      await kiemTraMem(the, duLieu.ten + ': giữ đúng nhà xe đã chọn').toContainText(nhaXe);
      const soLoiTruoc = testInfo.errors.length;
      await kiemTraMem.poll(() => docSoKhachTrenThe(the),
        duLieu.ten + ': số khách phải được ghi nhận độc lập').toBe(duLieu.soKhach);
      const quanSat = { buoc: 'CONTACT-CARD', chieu: duLieu.ten,
        soKhachMongDoi: duLieu.soKhach, soKhachThucTe: await docSoKhachTrenThe(the),
        trangThai: testInfo.errors.length === soLoiTruoc ? 'PASS' : 'FAIL',
        noiDung: await the.innerText() };
      cacKiemTra.push(quanSat);
      console.log('TC-BOOK-018 - Thông tin chuyến:', quanSat);
    }

    // 5. Tổng Tạm tính bằng tiền hai chiều với số khách khác nhau.
    const tongMongDoi = chieuDi.tongMongDoi + chieuVe.tongMongDoi;
    const nhanTamTinh = page.getByText('Tạm tính', { exact: true }).filter({ visible: true });
    await expect(nhanTamTinh).toHaveCount(1);
    await kiemTraMem.poll(async () => (await docTienTheoNhan(nhanTamTinh)).soTien,
      'Tạm tính phải bằng 2 × giá chiều đi + 1 × giá chiều về').toBe(tongMongDoi);
    const tamTinh = await docTienTheoNhan(nhanTamTinh);
    doiChieuTong = { chieuDi, chieuVe, tongMongDoi, tamTinh };
    await page.screenshot({ path: anh('CONTACT-2-GO-1-RETURN'), fullPage: true });

    // 6. Mở chi tiết Tạm tính để đối chiếu số khách và tiền từng chiều.
    const mauIconMoRong = /^icon-expand-(?:more|less)$/;
    const thanhTamTinh = nhanTamTinh.locator('xpath=ancestor::*')
      .filter({ has: page.getByRole('img', { name: mauIconMoRong }) }).last();
    const nutMoRong = thanhTamTinh.getByRole('img', { name: mauIconMoRong });
    await expect(nutMoRong).toHaveCount(1);
    await nutMoRong.click();
    const chiTietNoiTuyen = nhanTamTinh.locator('xpath=ancestor::*')
      .filter({ hasText: /chiều đi/i }).filter({ hasText: /chiều về/i })
      .filter({ hasNotText: /Thông tin chuyến đi/i }).last();
    const chiTietPopup = page.getByRole('dialog').or(page.locator('.ant-popover, .ant-drawer-content'))
      .filter({ visible: true }).filter({ hasText: /chiều đi/i }).filter({ hasText: /chiều về/i })
      .filter({ hasNotText: /Thông tin chuyến đi/i }).last();
    await expect(chiTietNoiTuyen.or(chiTietPopup).first()).toBeVisible();
    const khungChiTiet = await chiTietPopup.isVisible() ? chiTietPopup : chiTietNoiTuyen;
    for (const duLieu of [
      { ten: 'đi' as const, soKhach: 2, tongTien: chieuDi.tongMongDoi },
      { ten: 'về' as const, soKhach: 1, tongTien: chieuVe.tongMongDoi },
    ]) {
      const soLoiTruoc = testInfo.errors.length;
      await kiemTraMem.poll(async () => (await docChiTietChieu(khungChiTiet, duLieu.ten)).tongTien,
        'Chi tiết phải ghi đúng tổng tiền chiều ' + duLieu.ten).toBe(duLieu.tongTien);
      await kiemTraMem.poll(async () => docSoKhachVaGheChiTiet(
        (await docChiTietChieu(khungChiTiet, duLieu.ten)).text).soKhach,
        'Chi tiết phải giữ đúng số khách chiều ' + duLieu.ten).toBe(duLieu.soKhach);
      const chiTiet = await docChiTietChieu(khungChiTiet, duLieu.ten);
      const quanSat = { buoc: 'SUBTOTAL-DETAILS', chieu: duLieu.ten,
        soKhachMongDoi: duLieu.soKhach, tongMongDoi: duLieu.tongTien,
        ...docSoKhachVaGheChiTiet(chiTiet.text), ...chiTiet,
        trangThai: testInfo.errors.length === soLoiTruoc ? 'PASS' : 'FAIL' };
      cacKiemTra.push(quanSat);
      console.log('TC-BOOK-018 - Chi tiết từng chiều:', quanSat);
    }
    await page.screenshot({ path: anh('SUBTOTAL-DETAILS'), fullPage: true });
    ketQua = testInfo.errors.length === 0 ? 'PASS' : 'FAIL';
    console.log('TC-BOOK-018 - Đối chiếu tổng:', doiChieuTong);
    // Dừng ở trang liên hệ; không nhập liên hệ, không tạo đơn/thanh toán.
  } catch (error) {
    ketQua = testInfo.expectedStatus === 'skipped' && testInfo.errors.length === 0 ? 'SKIP' : 'FAIL';
    throw error;
  } finally {
    console.log('TC-BOOK-018 - Kết quả automation:', ketQua);
    await testInfo.attach('TC-BOOK-018-ket-qua', {
      body: Buffer.from(JSON.stringify({ ketQua, nhaXe, ngayDi: ngayDi.hienThi,
        ngayVe: ngayVe.hienThi, tuyen: 'Hà Nội ↔ Hải Phòng', dangNhap: false,
        thoiDiemChay, cacChieu, cacKiemTra, doiChieuTong,
        duLieuExcel: { gheChieuDi: ['9', '10'], gheChieuVe: ['8'], tamTinhLichSu: 510000 },
        phamVi: 'Số khách độc lập 2/1 và tiền theo giá hiện tại; mã ghế thực tế được ghi nhận.' }, null, 2)),
      contentType: 'application/json',
    });
    if (!page.isClosed()) await page.screenshot({ path: anh(ketQua), fullPage: true });
  }
});
