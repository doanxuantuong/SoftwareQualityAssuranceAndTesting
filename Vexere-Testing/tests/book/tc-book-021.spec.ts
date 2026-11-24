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

test('TC-BOOK-021 - Bấm Tiếp tục nhanh 5 lần liên tiếp', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const ngayDi = ngaySau(3);
  const ngayVe = ngaySau(5);
  const nhaXe = 'Anh Huy Travel';
  const thoiDiemChay = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });
  const kiemTraMem = expect.configure({ soft: true });
  const cacChieu: object[] = [];
  const cacKiemTra: object[] = [];
  const duLieuLienHe = {
    hoTen: 'khanh lê viết', soDienThoai: '0912345678', email: 'vexere.tc021@example.com',
  };
  type SuKien = {
    loai: string; taiLieu: string; thoiGian: number; suKien?: string; isTrusted?: boolean;
    noiDung?: string; laTiepTucLienHe?: boolean; soLanMo?: number; nhieuNhat?: number;
  };
  const suKienUI: Array<SuKien & { giaiDoan: string }> = [];
  const cacLanThuBam: Array<{ lan: number; thoiGian: number; x: number; y: number }> = [];
  const cacPopupChinhSach = new Map<string, { soLanMo: number; nhieuNhat: number }>();
  const cacLanChuyenThanhToan: Array<{ duongDan: string; thoiGian: string }> = [];
  const cacCuaSoMoi: Array<{ url: string }> = [];
  const cacHoiThoai: Array<{ loai: string; noiDung: string }> = [];
  const cacLoiJS: string[] = [];
  let giaiDoan = 'SETUP';
  let duongDanTruoc = '';
  let soLanBamSauDongY = 0;
  let ketQua = 'FAIL';
  let doiChieu: object = {};
  const anh = (ten: string) => path.join(__dirname,
    'screenshots/TC-BOOK-021-' + testInfo.project.name + '-' + ten + '.png');

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
        console.log('TC-BOOK-021 - Chuyến ' + tenChieu + ':', thongTin);
        return thongTin;
      }
    }
    const lyDoThieuDuLieu = 'Thiếu dữ liệu: không có chuyến ' + nhaXe + ' ' + tenChieu
      + ' còn ít nhất ' + soChoCan + ' chỗ trong danh sách đang hiển thị.';
    // Không để trạng thái skip che các lỗi đã quan sát ở chiều trước.
    if (testInfo.errors.length > 0) throw new Error(lyDoThieuDuLieu + ' Trước đó đã có kiểm tra FAIL.');
    test.skip(true, lyDoThieuDuLieu);
    throw new Error('Không có chuyến để chuẩn bị TC021.');
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
    console.log('TC-BOOK-021 - Chọn số khách:', chieu);
    await page.screenshot({ path: anh(ma + '-SELECTED'), fullPage: true });
    return chieu;
  }


  const loiHeThong = () => page.getByText(
    /Ôi không!|Đã có lỗi xảy ra|Đã xảy ra lỗi|lỗi không mong muốn|something went wrong|unexpected error/i,
  ).filter({ visible: true });
  const theChuyen = (chieu: 'Chiều đi' | 'Chiều về') =>
    page.getByText(new RegExp('^' + chieu + '$', 'i')).filter({ visible: true }).locator(
      'xpath=ancestor::div[count(.//*[normalize-space(.)="Thay đổi" '
      + 'and not(.//*[normalize-space(.)="Thay đổi"])])=2][1]',
    );

  async function docTheChuyen(chieu: 'Chiều đi' | 'Chiều về') {
    const the = theChuyen(chieu);
    const soThe = await the.count();
    if (soThe !== 1) return { soThe, nhaXe: null, ngay: null, soKhach: null, diem: [] as string[] };
    const text = await the.innerText();
    const nhanKhach = the.getByRole('img', { name: 'vex-person-gray-16', exact: true })
      .locator('xpath=ancestor::*[normalize-space(.) != ""][1]');
    const coCotGio = './/*[translate(normalize-space(.), "0123456789", "") = ":" '
      + 'and (string-length(normalize-space(.)) = 4 or string-length(normalize-space(.)) = 5)]';
    const cacNutDoi = the.getByText('Thay đổi', { exact: true });
    const diem: string[] = [];
    for (let i = 0; i < await cacNutDoi.count(); i++) {
      diem.push((await cacNutDoi.nth(i).locator('xpath=ancestor::div[' + coCotGio + '][1]')
        .innerText()).replace(/\s+/g, ' ').trim());
    }
    return { soThe, nhaXe: await the.getByText(nhaXe, { exact: true }).count(),
      ngay: text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/)?.[0] ?? null,
      soKhach: await nhanKhach.count() === 1 ? (await nhanKhach.innerText()).trim() : null, diem };
  }

  // Chỉ quan sát sự kiện chuột và popup; không gọi handler ứng dụng hay tạo click bằng JavaScript.
  function caiDatTheoDoiUI() {
    type BanTin = {
      loai: string; taiLieu: string; thoiGian: number; suKien?: string; isTrusted?: boolean;
      noiDung?: string; laTiepTucLienHe?: boolean; soLanMo?: number; nhieuNhat?: number;
    };
    const w = window as typeof window & {
      tc021GhiNhan?: (banTin: BanTin) => Promise<void>;
      tc021DaTheoDoi?: boolean; tc021Quet?: () => void; tc021DungTheoDoi?: () => void;
    };
    if (w.tc021DaTheoDoi) return;
    w.tc021DaTheoDoi = true;
    const taiLieu = Date.now() + '-' + Math.random().toString(36).slice(2);
    const baoCao = (banTin: BanTin) => {
      if (w.tc021GhiNhan) void w.tc021GhiNhan(banTin).catch(() => {});
    };
    const theoDoiChuot = (event: MouseEvent) => {
      const dich = event.target instanceof Element ? event.target : null;
      const nut = dich?.closest('button');
      const noiDung = ((nut as HTMLElement | null)?.innerText || dich?.textContent || '').trim().slice(0, 120);
      baoCao({ loai: 'CHUOT', taiLieu, thoiGian: performance.timeOrigin + performance.now(),
        suKien: event.type, isTrusted: event.isTrusted, noiDung,
        laTiepTucLienHe: /\/bookingconfirmation(?:\/|$)/i.test(location.pathname) && /^Tiếp tục/i.test(noiDung) });
    };
    document.addEventListener('mousedown', theoDoiChuot, true);
    document.addEventListener('click', theoDoiChuot, true);
    let truoc = 0;
    let soLanMo = 0;
    let nhieuNhat = 0;
    let daBaoCao = -1;
    const quet = () => {
      const cacTieuDe = new Set<Element>();
      const walker = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if ((node.textContent || '').replace(/\s+/g, ' ').trim() !== 'Chính sách bảo vệ dữ liệu cá nhân') continue;
        const el = node.parentElement;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0
          && r.left < innerWidth && r.top < innerHeight && style.visibility !== 'hidden'
          && style.display !== 'none' && !el.closest('[aria-hidden="true"]')) cacTieuDe.add(el);
      }
      const hienTai = cacTieuDe.size;
      if (hienTai > truoc) soLanMo += hienTai - truoc;
      nhieuNhat = Math.max(nhieuNhat, hienTai);
      if (hienTai !== daBaoCao) {
        baoCao({ loai: 'CHINH_SACH', taiLieu, thoiGian: Date.now(), soLanMo, nhieuNhat });
        daBaoCao = hienTai;
      }
      truoc = hienTai;
    };
    const observer = new MutationObserver(quet);
    observer.observe(document, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
    const timer = window.setInterval(quet, 50);
    w.tc021Quet = quet;
    w.tc021DungTheoDoi = () => {
      observer.disconnect(); window.clearInterval(timer);
      document.removeEventListener('mousedown', theoDoiChuot, true);
      document.removeEventListener('click', theoDoiChuot, true);
    };
    quet();
  }

  try {
    // 1. Chuẩn bị khứ hồi Hà Nội ↔ Hải Phòng, chuẩn bị 1 khách mỗi chiều.
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
    console.log('TC-BOOK-021:', { nhaXe, tuyen: 'Hà Nội ↔ Hải Phòng',
      ngayDi: ngayDi.hienThi, ngayVe: ngayVe.hienThi, dangNhap: false });



    // 2. Chuẩn bị khứ hồi hợp lệ, 1 khách mỗi chiều.
    const chieuDi = await chonChieu('Chiều đi', 'GO', 1);
    const ketQuaVe = page.getByText(/Kết quả chiều về/).first();
    const diemDonTra = nutBuoc(1);
    await bamVaDongQuyDinh(nutBuoc(0), ketQuaVe.or(diemDonTra).filter({ visible: true }).first());
    if (!(await ketQuaVe.isVisible())) {
      await chonDiemConThieu();
      await bamVaDongQuyDinh(diemDonTra, ketQuaVe);
    }
    const chieuVe = await chonChieu('Chiều về', 'RETURN', 1);
    const hoTen = page.locator('#userName');
    await bamVaDongQuyDinh(nutBuoc(0), diemDonTra.or(hoTen).filter({ visible: true }).first());
    if (!(await hoTen.isVisible())) {
      await chonDiemConThieu();
      await bamVaDongQuyDinh(diemDonTra, hoTen);
    }
    await expect(page).toHaveURL(/\/bookingconfirmation(?:[/?#]|$)/, { timeout: 30000 });
    const dienThoai = page.getByRole('textbox', { name: 'Số điện thoại', exact: true });
    const email = page.getByRole('textbox', { name: 'Email nhận thông tin', exact: true });
    await hoTen.fill(duLieuLienHe.hoTen);
    await dienThoai.fill(duLieuLienHe.soDienThoai);
    await email.fill(duLieuLienHe.email);
    await page.locator('label[for="userName"]').filter({ visible: true }).click();
    const tiepTuc = page.getByRole('button', { name: /^Tiếp tục(?:\s|$)/i }).filter({ visible: true });
    await expect(tiepTuc).toHaveCount(1);
    await expect(tiepTuc).toBeEnabled();
    await expect(loiHeThong()).toHaveCount(0);
    const truoc = { di: await docTheChuyen('Chiều đi'), ve: await docTheChuyen('Chiều về') };
    for (const the of [truoc.di, truoc.ve]) {
      expect(the.soThe, 'Mỗi chiều phải có đúng 1 thẻ trước khi thử').toBe(1);
      expect(the.nhaXe).toBe(1);
      expect(the.soKhach).toBe('1');
    }
    const tongMongDoi = chieuDi.tongMongDoi + chieuVe.tongMongDoi;
    const nhanTamTinh = page.getByText('Tạm tính', { exact: true }).filter({ visible: true });
    await expect(nhanTamTinh).toHaveCount(1);
    await kiemTraMem.poll(async () => (await docTienTheoNhan(nhanTamTinh)).soTien,
      'Tạm tính trước thao tác phải đúng giá hai chiều').toBe(tongMongDoi);
    const tamTinh = await docTienTheoNhan(nhanTamTinh);
    await page.screenshot({ path: anh('BEFORE-RAPID-CLICK'), fullPage: true });
    console.log('TC-BOOK-021 - Điều kiện chạy:', { nhaXe, ngayDi: ngayDi.hienThi,
      ngayVe: ngayVe.hienThi, tuyen: 'Hà Nội ↔ Hải Phòng', dangNhap: false, thoiDiemChay, truoc, tamTinh });

    // 3. Theo dõi từ trước lượt click để có bằng chứng thao tác lặp và chuyển trang.
    const mauDuongDanThanhToan = /^\/(?:vi-VN\/)?payment-methods?\/[^/]+\/?$/i;
    duongDanTruoc = new URL(page.url()).pathname;
    page.on('framenavigated', frame => {
      if (frame !== page.mainFrame()) return;
      const duongDan = new URL(frame.url()).pathname;
      if (duongDan !== duongDanTruoc && mauDuongDanThanhToan.test(duongDan)) {
        cacLanChuyenThanhToan.push({ duongDan, thoiGian: new Date().toISOString() });
      }
      duongDanTruoc = duongDan;
    });
    page.on('popup', popup => {
      const ghiNhan = { url: popup.url() };
      cacCuaSoMoi.push(ghiNhan);
      popup.on('framenavigated', frame => {
        if (frame === popup.mainFrame()) ghiNhan.url = frame.url();
      });
    });
    page.on('dialog', async dialog => {
      cacHoiThoai.push({ loai: dialog.type(), noiDung: dialog.message() });
      await dialog.dismiss();
    });
    page.on('pageerror', error => { cacLoiJS.push(error.stack || error.message); });
    await page.exposeFunction('tc021GhiNhan', (suKien: SuKien) => {
      suKienUI.push({ ...suKien, giaiDoan });
      if (suKien.loai === 'CHINH_SACH') {
        cacPopupChinhSach.set(suKien.taiLieu, {
          soLanMo: suKien.soLanMo ?? 0, nhieuNhat: suKien.nhieuNhat ?? 0,
        });
      }
    });
    await page.addInitScript(caiDatTheoDoiUI);
    await page.evaluate(caiDatTheoDoiUI);

    // Năm lệnh click chuột thật cùng vị trí. Popup/nút khóa có thể chặn sự kiện DOM sau lần đầu.
    // Không dùng force, dispatchEvent hay gọi DOM click để bấm xuyên lớp chặn.
    const soLanThu = 5;
    await tiepTuc.click({ trial: true });
    const viTriNut = await tiepTuc.boundingBox();
    expect(viTriNut, 'Phải xác định được vị trí nút Tiếp tục trước lượt bấm').not.toBeNull();
    const x = viTriNut!.x + viTriNut!.width / 2;
    const y = viTriNut!.y + viTriNut!.height / 2;
    giaiDoan = 'RAPID-CONTINUE';
    for (let lan = 1; lan <= soLanThu; lan++) {
      const thoiGian = Date.now();
      await page.mouse.click(x, y, { delay: 50 });
      cacLanThuBam.push({ lan, thoiGian, x, y });
    }
    await expect.poll(() => suKienUI.filter(e => e.loai === 'CHUOT' && e.suKien === 'click'
      && e.isTrusted && e.laTiepTucLienHe && e.giaiDoan === 'RAPID-CONTINUE').length,
      { message: 'Click thật đầu tiên phải đến nút Tiếp tục ở trang liên hệ', timeout: 3000 })
      .toBeGreaterThanOrEqual(1);
    giaiDoan = 'AFTER-RAPID-CLICK';
    const cacLanNhanChuot = suKienUI.filter(e => e.loai === 'CHUOT' && e.suKien === 'mousedown'
      && e.isTrusted && e.giaiDoan === 'RAPID-CONTINUE');
    cacKiemTra.push({ buoc: 'RAPID-CLICK', soLanThu,
      soLenhClickDaGui: cacLanThuBam.length, cacLanThuBam,
      soSuKienNhanChuotQuanSatDuoc: cacLanNhanChuot.length, cacLanNhanChuot });
    console.log('TC-BOOK-021 - Bằng chứng bấm nhanh:', {
      soLanThu, soLenhClickDaGui: cacLanThuBam.length,
      soSuKienNhanChuotQuanSatDuoc: cacLanNhanChuot.length,
      khoangThoiGianMs: cacLanThuBam[cacLanThuBam.length - 1].thoiGian - cacLanThuBam[0].thoiGian,
    });
    await page.screenshot({ path: anh('AFTER-RAPID-CLICK'), fullPage: true });

    // 4. Xác nhận tối đa một popup chính sách, nếu được yêu cầu.
    const phuongThucThanhToan = page.getByText('Phương thức thanh toán', { exact: true });
    const chinhSach = page.getByText('Chính sách bảo vệ dữ liệu cá nhân', { exact: true })
      .filter({ visible: true });
    await expect(phuongThucThanhToan.or(chinhSach).filter({ visible: true }).first())
      .toBeVisible({ timeout: 30000 });
    if (await chinhSach.isVisible()) {
      await kiemTraMem(chinhSach, 'Không được đồng thời hiển thị trùng popup chính sách').toHaveCount(1);
      const popup = chinhSach.first().locator('xpath=ancestor::*[.//button[normalize-space(.)="Xác nhận"]][1]');
      const dongY = popup.getByRole('checkbox').filter({ visible: true });
      giaiDoan = 'CONSENT';
      await page.screenshot({ path: anh('DATA-POLICY'), fullPage: true });
      if (await dongY.count() > 0) {
        await expect(dongY).toHaveCount(1);
        await dongY.check();
      }
      await popup.getByRole('button', { name: 'Xác nhận', exact: true }).click();
      await expect(chinhSach).toHaveCount(0);
      // Một số luồng yêu cầu bấm Tiếp tục sau khi đồng ý; tách rõ khỏi lượt thử 5 click.
      const daDenThanhToan = await phuongThucThanhToan.waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true, error => {
          if (error instanceof Error && error.name === 'TimeoutError') return false;
          throw error;
        });
      if (!daDenThanhToan && await tiepTuc.isVisible()) {
        giaiDoan = 'CONTINUE-AFTER-CONSENT';
        await expect(tiepTuc).toBeEnabled();
        soLanBamSauDongY++;
        await tiepTuc.click();
      }
    }
    await expect(phuongThucThanhToan).toBeVisible({ timeout: 30000 });
    await expect(page).toHaveURL(url => mauDuongDanThanhToan.test(url.pathname), { timeout: 30000 });

    // 5. Cửa sổ quan sát các phản hồi trễ sau lượt bấm nhanh.
    giaiDoan = 'OBSERVE-PAYMENT';
    const thoiGianQuanSatSauThanhToanMs = 3000;
    await page.waitForTimeout(thoiGianQuanSatSauThanhToanMs);
    await page.evaluate(() => {
      (window as typeof window & { tc021Quet?: () => void }).tc021Quet?.();
    });
    const soLanMoChinhSach = Array.from(cacPopupChinhSach.values()).reduce((tong, p) => tong + p.soLanMo, 0);
    const popupDongThoiNhieuNhat = Math.max(0, ...Array.from(cacPopupChinhSach.values()).map(p => p.nhieuNhat));
    await kiemTraMem(soLanMoChinhSach, 'Một lượt Tiếp tục không được mở chính sách lặp nhiều lần')
      .toBeLessThanOrEqual(1);
    await kiemTraMem(popupDongThoiNhieuNhat, 'Không có nhiều popup chính sách chồng nhau')
      .toBeLessThanOrEqual(1);
    await kiemTraMem(cacLanChuyenThanhToan, 'Chỉ được chuyển sang trang thanh toán một lần').toHaveLength(1);
    await kiemTraMem(cacCuaSoMoi, 'Không được mở thêm cửa sổ thanh toán do thao tác lặp').toHaveLength(0);
    await kiemTraMem(cacHoiThoai, 'Không xuất hiện hộp thoại lỗi ngoài dự kiến').toHaveLength(0);
    await kiemTraMem(loiHeThong(), 'Không xuất hiện lỗi giao diện khi bấm liên tiếp').toHaveCount(0);
    await kiemTraMem(phuongThucThanhToan, 'Chỉ có một màn hình phương thức thanh toán').toHaveCount(1);
    const sau = { di: await docTheChuyen('Chiều đi'), ve: await docTheChuyen('Chiều về') };
    await kiemTraMem(sau, 'Thông tin mỗi chiều chỉ xuất hiện một lần và giữ đúng lựa chọn').toEqual(truoc);
    const nhanTongTien = page.getByText('Tổng tiền', { exact: true }).filter({ visible: true });
    await kiemTraMem(nhanTongTien, 'Chỉ có một tổng tiền thanh toán').toHaveCount(1);
    let tongTien: { soTien: number | null; text: string } | null = null;
    if (await nhanTongTien.count() === 1) {
      await kiemTraMem.poll(async () => (await docTienTheoNhan(nhanTongTien)).soTien,
        'Bấm nhiều lần không được làm nhân đôi tổng tiền').toBe(tongMongDoi);
      tongTien = await docTienTheoNhan(nhanTongTien);
    }
    doiChieu = { soLanThu, soLenhClickDaGui: cacLanThuBam.length,
      soSuKienNhanChuotQuanSatDuoc: cacLanNhanChuot.length, soLanBamSauDongY,
      soLanMoChinhSach, popupDongThoiNhieuNhat, cacLanChuyenThanhToan, cacCuaSoMoi,
      truoc, sau, tamTinh, tongMongDoi, tongTien, thoiGianQuanSatSauThanhToanMs };
    cacKiemTra.push({ buoc: 'PAYMENT-NO-DUPLICATES', ...doiChieu });
    console.log('TC-BOOK-021 - Kết quả đối chiếu:', doiChieu);
    await page.screenshot({ path: anh('PAYMENT'), fullPage: true });
    // Dừng tại trang thanh toán; không chọn phương thức hoặc bấm Thanh toán.
    ketQua = testInfo.errors.length === 0 ? 'PASS' : 'FAIL';
  } catch (error) {
    ketQua = testInfo.expectedStatus === 'skipped' && testInfo.errors.length === 0 ? 'SKIP' : 'FAIL';
    throw error;
  } finally {
    giaiDoan = 'FINISH';
    if (!page.isClosed()) {
      await page.evaluate(() => {
        (window as typeof window & { tc021DungTheoDoi?: () => void }).tc021DungTheoDoi?.();
      }).catch(() => {});
    }
    console.log('TC-BOOK-021 - Kết quả automation:', ketQua);
    await testInfo.attach('TC-BOOK-021-ket-qua', {
      body: Buffer.from(JSON.stringify({ ketQua, nhaXe, tuyen: 'Hà Nội ↔ Hải Phòng',
        ngayDi: ngayDi.hienThi, ngayVe: ngayVe.hienThi, dangNhap: false, thoiDiemChay,
        duLieuLienHe, cacChieu, cacKiemTra, cacLanThuBam, suKienUI, cacLanChuyenThanhToan,
        cacCuaSoMoi, cacHoiThoai, cacLoiJS, doiChieu,
        phamVi: '5 lần bấm chuột thật, popup chính sách, điều hướng và hiển thị chuyến/tổng tiền. '
          + 'Chưa đối soát đơn ở máy chủ; không kết luận từ giao diện rằng chắc chắn không có đơn trùng. Không thanh toán.',
      }, null, 2)),
      contentType: 'application/json',
    });
    if (!page.isClosed()) await page.screenshot({ path: anh(ketQua), fullPage: true });
  }
});
