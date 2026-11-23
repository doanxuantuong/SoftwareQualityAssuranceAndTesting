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

// Bốn biến thể của cùng TC017 có kết quả độc lập. Không dùng mode serial
// vì một nhánh FAIL/SKIP không được làm mất kết quả các nhánh còn lại.
test.describe.configure({ mode: 'default' });
const cacBienThe = [
  { ma: 'GO-PICKUP', chieu: 'Chiều đi', viTri: 0, ten: 'Đổi điểm đón chiều đi' },
  { ma: 'GO-DROPOFF', chieu: 'Chiều đi', viTri: 1, ten: 'Đổi điểm trả chiều đi' },
  { ma: 'RETURN-PICKUP', chieu: 'Chiều về', viTri: 0, ten: 'Đổi điểm đón chiều về' },
  { ma: 'RETURN-DROPOFF', chieu: 'Chiều về', viTri: 1, ten: 'Đổi điểm trả chiều về' },
] as const;

for (const bienThe of cacBienThe) {
test('TC-BOOK-017 - ' + bienThe.ma + ' - ' + bienThe.ten, async ({ page }, testInfo) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);

  const ngayDi = ngaySau(3);
  const ngayVe = ngaySau(5);
  const nhaXe = 'Anh Huy Travel';
  const thoiDiemChay = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });
  const kiemTraMem = expect.configure({ soft: true });
  const cacKiemTra: object[] = [];
  const cacChuyen: object[] = [];
  let ketQua = 'FAIL';
  const anh = (ten: string) => path.join(__dirname,
    'screenshots/TC-BOOK-017-' + testInfo.project.name + '-' + bienThe.ma + '-' + ten + '.png');

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
        console.log('TC-BOOK-017 - Chuyến ' + tenChieu + ':', thongTin);
        return;
      }
    }
    test.skip(true, bienThe.ma + ': không thấy chuyến ' + nhaXe + ' ' + tenChieu + ' còn chỗ.');
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


  type Chieu = 'Chiều đi' | 'Chiều về';
  type Diem = { ten: string; gio: string; text: string };
  const cacChieu: Chieu[] = ['Chiều đi', 'Chiều về'];
  const cacNhom = ['Điểm đón', 'Điểm trả'];
  const thieuDuLieu: string[] = [];
  const duLieuLienHe = {
    hoTen: 'khanh lê viết', soDienThoai: '0912345678', email: 'vexere.tc017@example.com',
  };
  const hoTen = page.locator('#userName');
  const dienThoai = page.getByRole('textbox', { name: 'Số điện thoại', exact: true });
  const email = page.getByRole('textbox', { name: 'Email nhận thông tin', exact: true });
  const coCotGio = './/*[translate(normalize-space(.), "0123456789", "") = ":" '
    + 'and (string-length(normalize-space(.)) = 4 or string-length(normalize-space(.)) = 5)]';

  // Mỗi thẻ chuyến có đúng hai liên kết Thay đổi; tránh nhầm với tab chính sách giá.
  const theChuyen = (chieu: Chieu) => page.getByText(new RegExp('^' + chieu + '$', 'i'))
    .filter({ visible: true }).locator(
      'xpath=ancestor::div[count(.//*[normalize-space(.)="Thay đổi" '
      + 'and not(.//*[normalize-space(.)="Thay đổi"])])=2][1]',
    );
  const nutDoi = (chieu: Chieu, viTri: number) =>
    theChuyen(chieu).getByText('Thay đổi', { exact: true }).nth(viTri);
  const dongDiem = (chieu: Chieu, viTri: number) =>
    nutDoi(chieu, viTri).locator('xpath=ancestor::div[' + coCotGio + '][1]');

  function tachDiem(text: string): Diem {
    const gio = text.match(/\b\d{1,2}:\d{2}\b/)?.[0];
    expect(gio, 'Phải đọc được giờ tại điểm đón/trả').toBeTruthy();
    const dong = text.split('\n').map(d => d.trim()).filter(Boolean);
    const viTri = dong.findIndex(d => d.includes(gio!));
    const ten = [dong[viTri].replace(gio!, '').trim(), ...dong.slice(viTri + 1)]
      .find(d => /[0-9A-Za-zÀ-ỹ]/.test(d)
        && !/^(Trung chuyển|Lưu ý quan trọng|Bản đồ|Thay đổi|place|emoji)$/i.test(d));
    expect(ten, 'Phải đọc được tên địa điểm cùng hàng với giờ').toBeTruthy();
    return { ten: ten!, gio: gio!, text };
  }

  async function docBonDiem() {
    const ketQua: Record<string, Diem> = {};
    for (const chieu of cacChieu) {
      await expect(theChuyen(chieu)).toHaveCount(1);
      await expect(theChuyen(chieu).getByText('Thay đổi', { exact: true })).toHaveCount(2);
      for (let i = 0; i < cacNhom.length; i++) {
        ketQua[chieu + ' - ' + cacNhom[i]] = tachDiem(await dongDiem(chieu, i).innerText());
      }
    }
    return ketQua;
  }

  async function docLienHe() {
    return { hoTen: await hoTen.inputValue(), soDienThoai: await dienThoai.inputValue(),
      email: await email.inputValue() };
  }

  async function kiemTraLienHe() {
    await kiemTraMem(hoTen, 'Đổi điểm không được làm mất họ tên đã nhập').toHaveValue(duLieuLienHe.hoTen);
    await kiemTraMem(dienThoai, 'Đổi điểm không được làm mất SĐT đã nhập')
      .toHaveValue(duLieuLienHe.soDienThoai);
    await kiemTraMem(email, 'Đổi điểm không được làm mất email đã nhập').toHaveValue(duLieuLienHe.email);
  }

  // Các drawer đã đóng vẫn giữ tiêu đề trong DOM. Ghim đúng nhóm và chiều
  // đang đổi, không gom tiêu đề của cả bốn drawer bằng một regex chung.
  const tieuDeSua = (chieu: Chieu, viTri: number) => page.getByText(new RegExp(
    '^Thay đổi ' + cacNhom[viTri].toLocaleLowerCase('vi-VN')
      + ' ' + chieu.toLocaleLowerCase('vi-VN') + '$', 'i',
  )).filter({ visible: true });
  const khungSua = (tieuDe: Locator) => tieuDe.locator(
    'xpath=ancestor::*[.//input[@type="radio"] or .//*[@role="radio"]][1]',
  );

  async function dongKhungSua(tieuDe: Locator) {
    // Drawer giữ tiêu đề trong DOM sau khi trượt khỏi màn hình.
    // isVisible() vẫn có thể là true; phải chờ nó ra khỏi viewport.
    const daDong = () => expect(tieuDe).not.toBeInViewport({ timeout: 2000 })
      .then(() => true, () => false);
    if (await daDong()) {
      await expect(hoTen).toBeVisible();
      return;
    }
    await page.keyboard.press('Escape');
    if (!(await daDong())) {
      const nutDong = khungSua(tieuDe).getByRole('button', { name: /^(Đóng|close|Quay lại|Trở lại)$/i })
        .filter({ visible: true });
      if (await nutDong.count() === 1) {
        await nutDong.click();
      } else {
        // Mũi tên quay lại nằm cùng hàng tiêu đề trong ảnh Excel.
        const thanhTieuDe = tieuDe.locator(
          'xpath=ancestor::*[.//button or .//svg or .//i or .//img or .//*[@role="button"]][1]',
        );
        const muiTen = thanhTieuDe.getByText('arrow_back', { exact: true });
        await expect(muiTen, 'Chỉ bấm mũi tên khi khung đổi điểm còn trên màn hình')
          .toBeInViewport();
        await muiTen.click();
      }
    }
    await expect(tieuDe, 'Khung đổi điểm phải đóng sau khi chọn/quay lại')
      .not.toBeInViewport();
    await expect(hoTen).toBeVisible();
  }

  async function timDiemKhac(cacRadio: Locator, diemCu: Diem) {
    if (await cacRadio.count() < 2) return null;
    for (let i = 0; i < await cacRadio.count(); i++) {
      const radio = cacRadio.nth(i);
      const hang = radio.locator(
        'xpath=ancestor::*[count(.//input[@type="radio"] | .//*[@role="radio"])=1][last()]',
      );
      const text = await hang.innerText();
      // Dùng điểm cố định, không phụ phí, để có thể đối chiếu Tạm tính không đổi.
      if (/Trung chuyển|phụ phí|\d[\d.,]*\s*[đ₫](?=\s|$)/i.test(text)) continue;
      const diem = tachDiem(text);
      if (diem.ten !== diemCu.ten) return { radio, diem };
    }
    return null;
  }

  async function doiDiem(chieu: Chieu, viTri: number, maBuoc: string) {
    const tenNhom = cacNhom[viTri];
    const khoa = chieu + ' - ' + tenNhom;
    const tieuDe = tieuDeSua(chieu, viTri);
    const truoc = { diem: await docBonDiem(), lienHe: await docLienHe(), tamTinh: await docTamTinh() };
    await page.screenshot({ path: anh('BEFORE'), fullPage: true });
    await nutDoi(chieu, viTri).click();
    await expect(tieuDe, 'Phải mở đúng nhóm điểm và chiều đang đổi').toHaveCount(1);
    await expect(tieuDe).toBeInViewport();
    const khung = khungSua(tieuDe);
    const cacRadio = khung.getByRole('radio').filter({ visible: true });
    await expect(cacRadio.first()).toBeVisible();

    const luaChon = await timDiemKhac(cacRadio, truoc.diem[khoa]);
    if (!luaChon) {
      const soLuaChon = await cacRadio.count();
      const lyDo = khoa + (soLuaChon === 1
        ? ': chuyến chỉ có 1 lựa chọn, không thể đổi sang điểm khác.'
        : ': không có điểm cố định khác, không phụ phí, để thực hiện đổi điểm.');
      thieuDuLieu.push(lyDo);
      cacKiemTra.push({ buoc: maBuoc, trangThai: 'SKIP', soLuaChon, lyDo });
      console.log('TC-BOOK-017 - Thiếu dữ liệu:', lyDo);
      await page.screenshot({ path: anh('MISSING-DATA'), fullPage: true });
      await dongKhungSua(tieuDe);
      // Chỉ bỏ qua biến thể hiện tại; các biến thể còn lại có test riêng.
      test.skip(true, lyDo);
      return;
    }

    const diemMoi = luaChon.diem;
    await luaChon.radio.check();
    if (await tieuDe.isVisible()) {
      await expect(luaChon.radio).toBeChecked();
      await expect(khung.getByRole('radio', { checked: true })).toHaveCount(1);
      // Nếu UI có nút lưu/xác nhận thì dùng nút đó; không bấm Tiếp tục đặt vé.
      const xacNhan = khung.getByRole('button', { name: /^(Xác nhận|Cập nhật|Lưu|Hoàn tất)$/i })
        .filter({ visible: true });
      if (await xacNhan.count() === 1) await xacNhan.click();
    }
    await page.screenshot({ path: anh('SELECTED'), fullPage: true });
    await dongKhungSua(tieuDe);
    await expect(page).toHaveURL(/\/bookingconfirmation(?:[/?#]|$)/);
    const soLoiTruoc = testInfo.errors.length;
    const mongDoi = { ...truoc.diem, [khoa]: diemMoi };
    for (const chieuKiemTra of cacChieu) {
      for (let i = 0; i < cacNhom.length; i++) {
        const ma = chieuKiemTra + ' - ' + cacNhom[i];
        const hang = dongDiem(chieuKiemTra, i);
        await kiemTraMem(hang, ma + ': giữ/cập nhật đúng tên điểm')
          .toContainText(mongDoi[ma].ten);
        await kiemTraMem(hang.getByText(/^\d{1,2}:\d{2}$/), ma + ': giữ/cập nhật đúng giờ')
          .toHaveText(mongDoi[ma].gio);
      }
    }
    await kiemTraLienHe();
    await kiemTraMem.poll(docTamTinh, 'Đổi điểm không phụ phí phải giữ đúng Tạm tính').toBe(truoc.tamTinh);
    const sau = { diem: await docBonDiem(), lienHe: await docLienHe(), tamTinh: await docTamTinh() };
    const trangThai = testInfo.errors.length === soLoiTruoc ? 'PASS' : 'FAIL';
    const quanSat = { buoc: maBuoc, chieu, tenNhom, trangThai, diemMoi, truoc, sau };
    cacKiemTra.push(quanSat);
    console.log('TC-BOOK-017 - Đổi điểm:', quanSat);
    await page.screenshot({ path: anh(trangThai), fullPage: true });
  }

  try {
    // 1. Chuẩn bị khứ hồi, mỗi chiều 1 khách. TC017 chỉ đổi điểm tại trang liên hệ.
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
    await bamVaDongQuyDinh(nutBuoc(0), diemDonTra.or(hoTen).filter({ visible: true }).first());
    if (!(await hoTen.isVisible())) {
      await chonDiemConThieu();
      await bamVaDongQuyDinh(diemDonTra, hoTen);
    }
    await expect(page).toHaveURL(/\/bookingconfirmation(?:[/?#]|$)/, { timeout: 30000 });

    console.log('TC-BOOK-017 - Điều kiện chạy:', { bienThe, nhaXe, ngayDi: ngayDi.hienThi,
      ngayVe: ngayVe.hienThi, tuyen: 'Hà Nội ↔ Hải Phòng', soKhachMoiChieu: 1,
      dangNhap: false, thoiDiemChay });
    await expect(dienThoai).toBeVisible();
    await expect(email).toBeVisible();
    await hoTen.fill(duLieuLienHe.hoTen);
    await dienThoai.fill(duLieuLienHe.soDienThoai);
    await email.fill(duLieuLienHe.email);
    // Nhãn nổi che giữa ô rỗng: chuyển focus qua label thay vì click tâm input.
    await page.locator('label[for="userName"]').filter({ visible: true }).click();
    await expect(hoTen).toHaveValue(duLieuLienHe.hoTen);
    await expect(dienThoai).toHaveValue(duLieuLienHe.soDienThoai);
    await expect(email).toHaveValue(duLieuLienHe.email);
    await expect.poll(docTamTinh, 'Phải đọc được Tạm tính trước khi đổi điểm').toBeGreaterThan(0);
    console.log('TC-BOOK-017 - Trước đổi điểm:', {
      diem: await docBonDiem(), lienHe: await docLienHe(), tamTinh: await docTamTinh(),
    });

    // 2. Mỗi test kiểm tra một biến thể của TC017, có page và kết quả riêng.
    await doiDiem(bienThe.chieu, bienThe.viTri, bienThe.ma);
    ketQua = testInfo.errors.length === 0 ? 'PASS' : 'FAIL';
    // Dừng ở trang liên hệ; không chuyển sang thanh toán, không tạo đơn.
  } catch (error) {
    ketQua = testInfo.expectedStatus === 'skipped' && testInfo.errors.length === 0 ? 'SKIP' : 'FAIL';
    throw error;
  } finally {
    console.log('TC-BOOK-017 - Kết quả nhánh ' + bienThe.ma + ':', ketQua);
    await testInfo.attach('TC-BOOK-017-' + bienThe.ma + '-ket-qua', {
      body: Buffer.from(JSON.stringify({ bienThe, ketQua, duLieuLienHe, nhaXe,
        ngayDi: ngayDi.hienThi, ngayVe: ngayVe.hienThi, thoiDiemChay,
        cacChuyen, cacKiemTra, thieuDuLieu }, null, 2)),
      contentType: 'application/json',
    });
    if (!page.isClosed()) await page.screenshot({ path: anh(ketQua), fullPage: true });
  }
});
}
