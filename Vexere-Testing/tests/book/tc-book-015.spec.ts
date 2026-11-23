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

// Chỉ đọc thông báo gắn với một trường, tránh lấy nhầm lỗi của trường khác.
async function docTrangThaiTruong(truong: Locator) {
  return truong.evaluate(el => {
    const input = el as HTMLInputElement;
    const hienThi = (node: Element) => node.getClientRects().length > 0
      && getComputedStyle(node).visibility !== 'hidden';
    const mauLoi = /vui lòng|bắt buộc|không.*(?:hợp lệ|được|hỗ trợ)|không để trống|chưa nhập|cần nhập|required|invalid|please enter/i;

    // Wrapper ngoài cùng chỉ chứa input này, trước khối chứa nhiều trường.
    let khung = input.parentElement;
    while (khung?.parentElement
      && khung.parentElement.querySelectorAll('input, textarea').length === 1) {
      khung = khung.parentElement;
    }

    const cacLoi: string[] = [];
    const them = (node: Element | null, laThongBaoLoi: boolean) => {
      if (!node || !hienThi(node)) return;
      const text = ((node as HTMLElement).innerText || node.textContent || '').trim();
      if (text && (laThongBaoLoi || mauLoi.test(text))) cacLoi.push(text);
    };
    for (const thuocTinh of ['aria-errormessage', 'aria-describedby']) {
      for (const id of (input.getAttribute(thuocTinh) || '').split(/\s+/).filter(Boolean)) {
        them(document.getElementById(id), thuocTinh === 'aria-errormessage');
      }
    }
    if (khung) {
      for (const node of Array.from(khung.querySelectorAll(
        '[role="alert"], .ant-form-explain, .ant-form-item-explain-error, '
        + '[class*="error-message"], [class*="ErrorMessage"], '
        + '[class*="error-text"], [class*="ErrorText"]',
      ))) them(node, true);
      // Một số ô dùng thẻ văn bản thường cho lỗi, không có role/class riêng.
      for (const node of Array.from(khung.querySelectorAll('p, span, small, div'))) {
        if (node.children.length === 0) them(node, false);
      }
    }
    return {
      giaTri: input.value,
      ariaInvalid: input.getAttribute('aria-invalid'),
      loi: Array.from(new Set(cacLoi)),
    };
  });
}

test('TC-BOOK-015 - Tổng tiền vé khứ hồi và khớp ở các bước', async ({ page }, testInfo) => {
  test.setTimeout(300000);
  page.setDefaultTimeout(15000);

  const ngayDi = ngaySau(3);
  const ngayVe = ngaySau(5);
  const nhaXe = 'Anh Huy Travel';
  const kiemTraMem = expect.configure({ soft: true });
  const cacKiemTra: object[] = [];
  const cacChieu: Array<{
    ten: string; ngay: string; tuyen: string; donGia: number;
    soKhach: number; tongMongDoi: number; tongThucTe: number | null; thongTinChuyen: string;
  }> = [];
  let doiChieuTong: object = { trangThai: 'NOT RUN' };
  let ketQua = 'FAIL';
  const anh = (ten: string) => path.join(__dirname,
    'screenshots/TC-BOOK-015-' + testInfo.project.name + '-' + ten + '.png');

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

  async function moChuyenDu8Cho(tenChieu: string) {
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
      if (thongTin.includes(nhaXe) && conCho >= 8) {
        await nut.click();
        await expect(boDem()).toBeVisible({ timeout: 20000 });
        console.log('TC-BOOK-015 - Chuyến ' + tenChieu + ':', thongTin);
        return thongTin;
      }
    }
    const lyDoThieuDuLieu = 'Thiếu dữ liệu: không có chuyến ' + nhaXe + ' ' + tenChieu
      + ' còn ít nhất 8 chỗ trong danh sách đang hiển thị.';
    // Không để trạng thái skip che các lỗi đã quan sát ở chiều trước.
    if (testInfo.errors.length > 0) throw new Error(lyDoThieuDuLieu + ' Trước đó đã có kiểm tra FAIL.');
    test.skip(true, lyDoThieuDuLieu);
    throw new Error('Không có chuyến để chuẩn bị TC015.');
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

  async function kiemTraMoc(tenChieu: string, maAnh: string, muc: number, donGia: number) {
    await datSoKhach(muc);
    const soLoiTruoc = testInfo.errors.length;
    await kiemTraMem.poll(async () => (await docFooterChieu()).soKhach,
      tenChieu + ': footer phải hiển thị Ghế: ' + muc + ' Khách').toBe(muc);
    await kiemTraMem.poll(async () => (await docFooterChieu()).tongTien,
      tenChieu + ': Tổng cộng phải bằng đơn giá × ' + muc).toBe(donGia * muc);
    const footer = await docFooterChieu();
    const trangThai = testInfo.errors.length === soLoiTruoc ? 'PASS' : 'FAIL';
    cacKiemTra.push({ buoc: 'QUANTITY', chieu: tenChieu, muc, donGia,
      tongMongDoi: donGia * muc, trangThai, ...footer });
    console.log('TC-BOOK-015 - Giá theo khách:', { chieu: tenChieu, muc, donGia,
      mongDoi: donGia * muc, thucTe: footer.tongTien, trangThai });
    await khungDatVe().screenshot({ path: anh(maAnh + '-QTY-' + muc + '-' + trangThai) });
  }

  async function kiemTraChieu(ten: string, ma: string, ngay: string, tuyen: string, soKhachCuoi: number) {
    const thongTinChuyen = await moChuyenDu8Cho(ten);
    const nhomGhe = khuVucKhach().locator('.seat-group-selection').first();
    const textDonGia = await nhomGhe.innerText();
    const gia = textDonGia.match(/(\d[\d.,]*)\s*[đ₫]/);
    expect(gia, 'Phải đọc được đơn giá ' + ten + ' trong nhóm ghế').not.toBeNull();
    const donGia = Number(gia![1].replace(/\D/g, ''));
    expect(donGia).toBeGreaterThan(0);
    // Mặc định 0/1 và giới hạn 0/9 thuộc TC001; chỉ chuẩn bị 1 khách hợp lệ ở đây.
    await datSoKhach(1);
    const cacMoc = [2, 3, 8, 2, 1];
    for (let i = 0; i < cacMoc.length; i++) {
      await kiemTraMoc(ten, ma + '-STEP-' + (i + 1), cacMoc[i], donGia);
    }
    if (soKhachCuoi !== 1) await kiemTraMoc(ten, ma + '-FINAL', soKhachCuoi, donGia);
    const footer = await docFooterChieu();
    const chieu = { ten, ngay, tuyen, donGia, soKhach: soKhachCuoi,
      tongMongDoi: donGia * soKhachCuoi, tongThucTe: footer.tongTien, thongTinChuyen };
    cacChieu.push(chieu);
    return chieu;
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

  try {
    // 1. Chuẩn bị khứ hồi Hà Nội ↔ Hải Phòng, chọn xe đủ 8 chỗ cho mỗi chiều.
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
    console.log('TC-BOOK-015:', { nhaXe, tuyen: 'Hà Nội ↔ Hải Phòng',
      ngayDi: ngayDi.hienThi, ngayVe: ngayVe.hienThi, dangNhap: false });

    // 2. Kiểm tra đủ mốc ở cả hai chiều. Cấu hình cuối: 2 khách đi, 1 khách về.
    const chieuDi = await kiemTraChieu('Chiều đi', 'GO', ngayDi.hienThi, 'Hà Nội → Hải Phòng', 2);
    const ketQuaChieuVe = page.getByText(/Kết quả chiều về/).first();
    const diemDonTra = nutBuoc(1);
    await bamVaDongQuyDinh(nutBuoc(0),
      ketQuaChieuVe.or(diemDonTra).filter({ visible: true }).first());
    if (!(await ketQuaChieuVe.isVisible())) {
      await chonDiemConThieu();
      await bamVaDongQuyDinh(diemDonTra, ketQuaChieuVe);
    }
    await expect(ketQuaChieuVe).toBeVisible({ timeout: 30000 });

    const chieuVe = await kiemTraChieu('Chiều về', 'RETURN', ngayVe.hienThi, 'Hải Phòng → Hà Nội', 1);
    const hoTen = page.locator('#userName');
    await bamVaDongQuyDinh(nutBuoc(0), diemDonTra.or(hoTen).filter({ visible: true }).first());
    if (!(await hoTen.isVisible())) {
      await chonDiemConThieu();
      await bamVaDongQuyDinh(diemDonTra, hoTen);
    }
    await expect(page).toHaveURL(/\/bookingconfirmation(?:[/?#]|$)/, { timeout: 30000 });
    await expect(hoTen).toBeVisible();

    // 3. Tạm tính bằng tổng hai chiều đã chọn, không dùng số tiền mẫu cố định trong Excel.
    const tongMongDoi = chieuDi.tongMongDoi + chieuVe.tongMongDoi;
    const tongTheoFooter = typeof chieuDi.tongThucTe === 'number' && typeof chieuVe.tongThucTe === 'number'
      ? chieuDi.tongThucTe + chieuVe.tongThucTe : null;
    const cacNhanTamTinh = page.getByText('Tạm tính', { exact: true }).filter({ visible: true });
    await expect(cacNhanTamTinh).toHaveCount(1);
    const nhanTamTinh = cacNhanTamTinh.first();
    await kiemTraMem.poll(async () => (await docTienTheoNhan(nhanTamTinh)).soTien,
      'Tạm tính phải bằng đơn giá × số khách của chiều đi và chiều về').toBe(tongMongDoi);
    await kiemTraMem(tongTheoFooter, 'Tổng ghi nhận ở hai footer phải khớp phép tính từng chiều')
      .toBe(tongMongDoi);
    const tamTinh = await docTienTheoNhan(nhanTamTinh);
    doiChieuTong = { cacChieu, tongMongDoi, tongTheoFooter, tamTinh };
    console.log('TC-BOOK-015 - Tổng hai chiều:', doiChieuTong);
    await page.screenshot({ path: anh('CONTACT-TOTAL'), fullPage: true });

    // 4. Mở chi tiết Tạm tính. Scope riêng khối giá, tránh lấy tab chính sách/card chuyến.
    // Nhãn Tạm tính không mở chi tiết; bấm đúng icon mũi tên cạnh số tiền.
    const mauIconMoRong = /^icon-expand-(?:more|less)$/;
    const thanhTamTinh = nhanTamTinh.locator('xpath=ancestor::*')
      .filter({ has: page.getByRole('img', { name: mauIconMoRong }) }).last();
    const nutMoRongTamTinh = thanhTamTinh.getByRole('img', { name: mauIconMoRong });
    await expect(nutMoRongTamTinh).toHaveCount(1);
    await nutMoRongTamTinh.click();
    const chiTietNoiTuyen = nhanTamTinh.locator('xpath=ancestor::*')
      .filter({ hasText: /chiều đi/i }).filter({ hasText: /chiều về/i })
      .filter({ hasNotText: /Thông tin chuyến đi/i }).last();
    const chiTietPopup = page.getByRole('dialog')
      .or(page.locator('.ant-popover, .ant-drawer-content'))
      .filter({ visible: true }).filter({ hasText: /chiều đi/i }).filter({ hasText: /chiều về/i })
      .filter({ hasNotText: /Thông tin chuyến đi/i }).last();
    await expect(chiTietNoiTuyen.or(chiTietPopup).first()).toBeVisible();
    const laPopupChiTiet = await chiTietPopup.isVisible();
    const khungChiTiet = laPopupChiTiet ? chiTietPopup : chiTietNoiTuyen;
    await kiemTraMem.poll(async () => (await docChiTietChieu(khungChiTiet, 'đi')).tongTien,
      'Chi tiết Tạm tính phải ghi đúng tổng chiều đi').toBe(chieuDi.tongMongDoi);
    await kiemTraMem.poll(async () => (await docChiTietChieu(khungChiTiet, 'về')).tongTien,
      'Chi tiết Tạm tính phải ghi đúng tổng chiều về').toBe(chieuVe.tongMongDoi);
    const chiTietDi = await docChiTietChieu(khungChiTiet, 'đi');
    const chiTietVe = await docChiTietChieu(khungChiTiet, 'về');
    console.log('TC-BOOK-015 - Chi tiết Tạm tính:', { chiTietDi, chiTietVe });
    cacKiemTra.push({ buoc: 'SUBTOTAL-DETAILS', chiTietDi, chiTietVe });
    await page.screenshot({ path: anh('SUBTOTAL-DETAILS'), fullPage: true });
    // Thu gọn bằng cùng mũi tên nếu mở trực tiếp; popup dùng nút đóng của chính nó.
    if (!laPopupChiTiet) await nutMoRongTamTinh.click();
    else {
      const nutDong = khungChiTiet.getByRole('button', { name: /^(Đóng|close|Close)$/ }).first();
      const nutDongAnt = khungChiTiet.locator('.ant-modal-close, .ant-drawer-close').first();
      if (await nutDong.isVisible()) await nutDong.click();
      else if (await nutDongAnt.isVisible()) await nutDongAnt.click();
      else await page.keyboard.press('Escape');
      await expect(khungChiTiet).toBeHidden();
    }

    // 5. Thông tin hợp lệ, sang trang thanh toán theo luồng đã kiểm tra ở TC005/008.
    const dienThoai = page.getByRole('textbox', { name: 'Số điện thoại', exact: true });
    const email = page.getByRole('textbox', { name: 'Email nhận thông tin', exact: true });
    await hoTen.fill('khanh lê viết');
    await dienThoai.fill('0912345678');
    await email.fill('vexere.tc015@example.com');
    await page.locator('label[for="userName"]').click();
    for (const truong of [hoTen, dienThoai, email]) {
      await expect.poll(async () => (await docTrangThaiTruong(truong)).loi,
        'Thông tin liên hệ hợp lệ phải không báo lỗi').toEqual([]);
      await expect.poll(async () => (await docTrangThaiTruong(truong)).ariaInvalid).not.toBe('true');
    }
    const tiepTuc = page.getByRole('button', { name: /^Tiếp tục(?:\s|$)/i }).filter({ visible: true });
    await expect(tiepTuc).toHaveCount(1);
    await expect(tiepTuc).toBeEnabled();
    await tiepTuc.click();
    const phuongThucThanhToan = page.getByText('Phương thức thanh toán', { exact: true });
    const chinhSachDuLieu = page.getByText('Chính sách bảo vệ dữ liệu cá nhân', { exact: true });
    await expect(phuongThucThanhToan.or(chinhSachDuLieu).filter({ visible: true }).first())
      .toBeVisible({ timeout: 30000 });
    if (await chinhSachDuLieu.isVisible()) {
      const popupDuLieu = chinhSachDuLieu
        .locator('xpath=ancestor::*[.//button[normalize-space(.)="Xác nhận"]][1]');
      const dongYDuLieu = popupDuLieu.getByRole('checkbox').filter({ visible: true });
      if (await dongYDuLieu.count() > 0) {
        await expect(dongYDuLieu).toHaveCount(1);
        await dongYDuLieu.check();
      }
      await popupDuLieu.getByRole('button', { name: 'Xác nhận', exact: true }).click();
      await expect(chinhSachDuLieu).toBeHidden();
      if (!(await phuongThucThanhToan.isVisible()) && await tiepTuc.isVisible()) await tiepTuc.click();
    }
    await expect(phuongThucThanhToan).toBeVisible({ timeout: 30000 });

    // 6. Tổng tiền thanh toán phải giữ đúng tổng hai chiều, chưa áp mã giảm giá.
    const nhanTongTien = page.getByText('Tổng tiền', { exact: true }).filter({ visible: true });
    await expect(nhanTongTien).toHaveCount(1);
    await kiemTraMem.poll(async () => (await docTienTheoNhan(nhanTongTien)).soTien,
      'Tổng tiền thanh toán phải bằng tổng hai chiều đã chọn').toBe(tongMongDoi);
    const tongTien = await docTienTheoNhan(nhanTongTien);
    await kiemTraMem(tongTien.soTien, 'Tổng tiền thanh toán phải bằng Tạm tính đã ghi nhận')
      .toBe(tamTinh.soTien);
    doiChieuTong = { cacChieu, tongMongDoi, tongTheoFooter, tamTinh, chiTietDi, chiTietVe, tongTien };
    console.log('TC-BOOK-015 - Đối chiếu cuối:', doiChieuTong);
    await page.screenshot({ path: anh('PAYMENT-TOTAL'), fullPage: true });
    // Không chọn phương thức, mã giảm giá hay bấm Thanh toán.
    ketQua = testInfo.errors.length === 0 ? 'PASS' : 'FAIL';
    console.log('TC-BOOK-015 - Kết quả automation:', ketQua);
  } catch (error) {
    ketQua = testInfo.expectedStatus === 'skipped' && testInfo.errors.length === 0 ? 'SKIP' : 'FAIL';
    throw error;
  } finally {
    await testInfo.attach('TC-BOOK-015-ket-qua', {
      body: Buffer.from(JSON.stringify({ ketQuaAutomation: ketQua, nhaXe,
        tuyen: 'Hà Nội ↔ Hải Phòng', ngayDi: ngayDi.hienThi, ngayVe: ngayVe.hienThi,
        dangNhap: false, cacChieu, cacKiemTra, doiChieuTong }, null, 2), 'utf8'),
      contentType: 'application/json',
    });
    if (!page.isClosed()) await page.screenshot({ path: anh(ketQua), fullPage: true });
  }
});
