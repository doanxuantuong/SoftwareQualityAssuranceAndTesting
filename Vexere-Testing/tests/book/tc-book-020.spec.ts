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

// Các lượt chạy độc lập để vẫn kiểm tra được cả hai vị trí F5.
test.describe.configure({ mode: 'default' });

const cacNhanh = [
  { ma: 'BACK-POINTS', ten: 'Quay lại từ bước chọn điểm đón/trả chiều về' },
  { ma: 'BACK-CONTACT', ten: 'Quay lại rồi mở lại trang liên hệ' },
  { ma: 'RELOAD-CONTACT', ten: 'F5 tại trang liên hệ' },
  { ma: 'RELOAD-POINTS', ten: 'F5 tại bước chọn điểm đón/trả chiều về' },
] as const;


for (const nhanh of cacNhanh) {
  test('TC-BOOK-020 - ' + nhanh.ten, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);

    const ngayDi = ngaySau(3);
    const ngayVe = ngaySau(5);
    const nhaXe = 'Anh Huy Travel';
    const urlLienHe = /\/bookingconfirmation(?:[/?#]|$)/;
    const duLieuLienHe = { hoTen: 'khanh lê viết', dienThoai: '0912345678', email: 'vexere.tc020@example.com' };
    const anh = (buoc: string) => path.join(__dirname,
      'screenshots/TC-BOOK-020-' + testInfo.project.name + '-' + nhanh.ma + '-' + buoc + '.png');

    const hoTen = page.locator('#userName');
    const dienThoai = page.getByRole('textbox', { name: 'Số điện thoại', exact: true });
    const email = page.getByRole('textbox', { name: 'Email nhận thông tin', exact: true });
    const ketQuaDi = page.getByText(/Kết quả chiều đi/).filter({ visible: true }).first();
    const ketQuaVe = page.getByText(/Kết quả chiều về/).filter({ visible: true }).first();
    const buocChonCho = () => nutBuoc(0);
    const buocChonDiem = () => nutBuoc(1);
    const sauChonCho = (dich: Locator) => buocChonDiem().or(dich).filter({ visible: true }).first();
    const thongBaoLoi = page.getByText(
      /đã có lỗi xảy ra trong quá trình xử l[íý]|đã xảy ra lỗi|lỗi không mong muốn|something went wrong|unexpected error/i,
    ).filter({ visible: true });
    const huongDan = page.getByText(
      /phiên (?:đặt vé|giữ chỗ).*(?:hết hạn|không còn hiệu lực)|(?:vui lòng|bạn cần).*?(?:tìm kiếm lại|chọn lại chuyến|bắt đầu lại|đặt vé lại)/i,
    ).filter({ visible: true });
    const tenNutKhoiPhuc = /^(?:Tìm kiếm(?: lại)?|Tìm lại|Chọn lại chuyến|Bắt đầu lại|Đặt (?:vé )?lại|Quay lại)$/i;
    const nutKhoiPhuc = page.getByRole('button', { name: tenNutKhoiPhuc })
      .or(page.getByRole('link', { name: tenNutKhoiPhuc })).filter({ visible: true });
    let ketQua = 'FAIL';

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
          console.log('TC-BOOK-020 - Chuyến ' + tenChieu + ':', thongTin);
          return thongTin;
        }
      }
      const lyDoThieuDuLieu = 'Thiếu dữ liệu: không có chuyến ' + nhaXe + ' ' + tenChieu
        + ' còn ít nhất ' + soChoCan + ' chỗ trong danh sách đang hiển thị.';
      console.log('TC-BOOK-020 - ' + lyDoThieuDuLieu);
      test.skip(true, lyDoThieuDuLieu);
      throw new Error('Không có chuyến để chuẩn bị TC020.');
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


    const nhomDiem = (ten: string) => khungDatVe().getByText(ten, { exact: true })
      .filter({ visible: true })
      .locator('xpath=ancestor::div[.//input[@type="radio"] or .//*[@role="radio"]][1]');

    async function docDiemDangChon() {
      const diem: Array<{ nhom: string; ten: string; gio: string }> = [];
      for (const tenNhom of ['Điểm đón', 'Điểm trả']) {
        const cacNhom = nhomDiem(tenNhom);
        await expect(cacNhom.first(), 'Phải có nhóm ' + tenNhom).toBeVisible();
        for (const nhom of await cacNhom.all()) {
          const radio = nhom.getByRole('radio', { checked: true });
          await expect(radio, tenNhom + ' phải còn điểm đã chọn').toHaveCount(1);
          const hang = radio.locator(
            'xpath=ancestor::*[count(.//input[@type="radio"] | .//*[@role="radio"])=1 and .//*[normalize-space(.)="Bản đồ"]][1]',
          );
          const text = await hang.innerText();
          const gio = text.match(/\b\d{1,2}:\d{2}\b/)?.[0];
          expect(gio, 'Phải đọc được giờ tại ' + tenNhom).toBeTruthy();
          const dong = text.split('\n').map(t => t.trim()).filter(Boolean);
          const viTriGio = dong.findIndex(t => t.includes(gio!));
          const ten = [dong[viTriGio].replace(gio!, '').trim(), ...dong.slice(viTriGio + 1)]
            .find(t => /[0-9A-Za-zÀ-ỹ]/.test(t) && !/^(Trung chuyển|Lưu ý quan trọng|Bản đồ|place|emoji)$/i.test(t));
          expect(ten, 'Phải đọc được tên tại ' + tenNhom).toBeTruthy();
          diem.push({ nhom: tenNhom, ten: ten!, gio: gio! });
        }
      }
      return diem;
    }

    const theChuyen = (chieu: 'Chiều đi' | 'Chiều về') =>
      page.getByText(new RegExp('^' + chieu + '$', 'i')).filter({ visible: true }).locator(
        'xpath=ancestor::div[count(.//*[normalize-space(.)="Thay đổi" '
        + 'and not(.//*[normalize-space(.)="Thay đổi"])])=2][1]',
      );

    async function docChuyenTaiLienHe() {
      const chuyen: string[] = [];
      for (const chieu of ['Chiều đi', 'Chiều về'] as const) {
        const the = theChuyen(chieu);
        await expect(the, 'Phải hiển thị đúng thẻ ' + chieu).toHaveCount(1);
        chuyen.push((await the.innerText()).replace(/\s+/g, ' ').trim());
      }
      return chuyen;
    }

    async function docLienHe() {
      return { hoTen: await hoTen.inputValue(), dienThoai: await dienThoai.inputValue(),
        email: await email.inputValue() };
    }

    async function denLienHe() {
      if (!(await hoTen.isVisible())) {
        await bamVaDongQuyDinh(buocChonDiem(), hoTen);
      }
      await expect(page).toHaveURL(urlLienHe);
    }

    async function nhapLienHe() {
      await hoTen.fill(duLieuLienHe.hoTen);
      await dienThoai.fill(duLieuLienHe.dienThoai);
      await email.fill(duLieuLienHe.email);
      await page.locator('label[for="userName"]').click();
      await expect.poll(docLienHe).toEqual(duLieuLienHe);
    }

    async function bamQuayLai(khung: Locator) {
      const mau = /^(?:[<‹←]\s*)?Quay lại$/i;
      const nut = khung.getByRole('button', { name: mau }).filter({ visible: true });
      if (await nut.count() === 1) {
        await nut.click();
      } else {
        await khung.getByText(mau).filter({ visible: true }).click();
      }
    }

    async function docLuaChonGheVe() {
      const soKhach = (await boDem().innerText()).trim();
      const nhomGhe = (await khuVucKhach().locator('.seat-group-selection').first().innerText())
        .replace(/\s+/g, ' ').trim();
      const gia = nhomGhe.match(/(\d[\d.,]*)\s*[đ₫]/)?.[1];
      expect(gia, 'Phải đọc được đơn giá của nhóm ghế chiều về').toBeTruthy();
      const donGia = Number(gia!.replace(/\D/g, ''));
      expect(donGia).toBeGreaterThan(0);
      const tongTien = donGia * Number(soKhach);
      // Footer có thể chứa nhiều bản sao chữ số trong lúc chạy hiệu ứng.
      await expect.poll(async () => (await docFooterChieu()).tongTien, {
        message: 'Tổng tiền chiều về phải bằng đơn giá nhân số khách',
      }).toBe(tongTien);
      return { soKhach, nhomGhe, tongTien };
    }

    async function doiChieuGheVe(truoc: Awaited<ReturnType<typeof docLuaChonGheVe>>, gioVe: string) {
      await expect(buocChonCho(), 'Quay lại phải mở bước chọn chỗ chiều về').toBeVisible();
      await expect(ketQuaVe).toBeVisible();
      await expect(khungDatVe()).toContainText(nhaXe);
      await expect(khungDatVe()).toContainText(gioVe);
      await expect(boDem(), 'Quay lại phải giữ số khách đã chọn').toHaveText(truoc.soKhach);
      const sau = await docLuaChonGheVe();
      console.log('TC-BOOK-020 - Đối chiếu lựa chọn chiều về:', { gioVe, truoc, sau });
      expect(sau, 'Quay lại phải giữ nhóm ghế và tiền của chuyến chiều về').toEqual(truoc);
    }

    async function doiChieuDiemTrenTheVe(diem: Awaited<ReturnType<typeof docDiemDangChon>>) {
      const theVe = theChuyen('Chiều về');
      await expect(theVe).toHaveCount(1);
      const coGio = './/*[translate(normalize-space(.), "0123456789", "") = ":" '
        + 'and (string-length(normalize-space(.)) = 4 or string-length(normalize-space(.)) = 5)]';
      for (const { ten, gio } of diem) {
        const hang = theVe.getByText(ten, { exact: true }).locator('xpath=ancestor::div[' + coGio + '][1]');
        await expect(hang.getByText(/^\d{1,2}:\d{2}$/), 'Giữ đúng giờ tại ' + ten).toHaveText(gio);
      }
    }

    async function thuF5(taiLienHe: boolean) {
      const oBuocMongDoi = async () => taiLienHe
        ? urlLienHe.test(page.url()) && await hoTen.isVisible() && await theChuyen('Chiều về').count() === 1
        : await ketQuaVe.isVisible() && await buocChonDiem().isVisible();
      expect(await oBuocMongDoi(), 'Phải ở đúng bước trước khi F5').toBe(true);
      await expect(thongBaoLoi).toHaveCount(0);
      const truoc = taiLienHe
        ? { lienHe: await docLienHe(), chuyen: await docChuyenTaiLienHe() }
        : { diem: await docDiemDangChon() };
      const urlTruoc = page.url();
      await page.screenshot({ path: anh('BEFORE-F5'), fullPage: true });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });

      // Cho phép UI tải xong hoặc đưa ra phản hồi rõ ràng trước khi kết luận mất luồng.
      // Danh sách chuyến có thể xuất hiện trong lúc ứng dụng đang khôi phục phiên.
      let trangThai = 'ĐANG TẢI';
      try {
        await expect.poll(async () => {
          if (await thongBaoLoi.first().isVisible()) trangThai = 'LỖI HỆ THỐNG';
          else if (await oBuocMongDoi()) trangThai = 'KHÔI PHỤC BƯỚC';
          else if (await huongDan.first().isVisible() && await nutKhoiPhuc.first().isVisible()
            && await nutKhoiPhuc.first().isEnabled()) trangThai = 'CÓ HƯỚNG DẪN';
          return trangThai;
        }, { timeout: 15000 }).not.toBe('ĐANG TẢI');
      } catch (error) {
        if (trangThai !== 'ĐANG TẢI') throw error;
        trangThai = 'KHÔNG KHÔI PHỤC BƯỚC';
      }

      const loi = await thongBaoLoi.allTextContents();
      const chiDan = await huongDan.allTextContents();
      const danhSach = (await ketQuaDi.isVisible()) || (await ketQuaVe.isVisible());
      const trangChu = /^\/(?:(?:vi-VN|vi)\/?)?$/i.test(new URL(page.url()).pathname)
        && await page.getByTestId('SearchWidget.from').isVisible();
      await page.screenshot({ path: anh('AFTER-F5'), fullPage: true });
      console.log('TC-BOOK-020 - Sau F5:', {
        nhanh: nhanh.ma, urlTruoc, urlSau: page.url(), truoc, trangThai, loi, chiDan,
        veTrangChu: trangChu, veDanhSachChuyen: danhSach,
      });

      if (loi.length > 0 || (trangThai === 'KHÔNG KHÔI PHỤC BƯỚC' && (trangChu || danhSach))) {
        const lyDo = loi.length > 0 ? loi.join(' ') : 'Mất bước đặt vé và không có hướng dẫn khôi phục.';
        testInfo.annotations.push({ type: 'BUG-004', description: lyDo });
        throw new Error('BUG-004 - ' + lyDo);
      }
      if (trangThai === 'CÓ HƯỚNG DẪN') return;
      expect(trangThai, 'F5 phải khôi phục bước đặt vé hoặc có hướng dẫn và nút để tiếp tục')
        .toBe('KHÔI PHỤC BƯỚC');

      if (taiLienHe && truoc.chuyen) {
        expect(await docChuyenTaiLienHe(), 'F5 phải giữ thông tin chuyến nếu vẫn ở trang liên hệ').toEqual(truoc.chuyen);
        // Excel yêu cầu ghi nhận dữ liệu liên hệ sau F5 theo hành vi thực tế.
        console.log('TC-BOOK-020 - Thông tin liên hệ sau F5:', await docLienHe());
      } else if (truoc.diem) {
        expect(await docDiemDangChon(), 'F5 phải giữ các điểm đã chọn nếu khôi phục bước đó').toEqual(truoc.diem);
      }
    }

    try {
      // Dùng chuyến khứ hồi cùng luồng đã chạy ở TC018.
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

      const chuyenDi = await moChuyen('Chiều đi', 1);
      await datSoKhach(1);
      await bamVaDongQuyDinh(buocChonCho(), sauChonCho(ketQuaVe));
      if (!(await ketQuaVe.isVisible())) {
        await chonDiemConThieu();
        await bamVaDongQuyDinh(buocChonDiem(), ketQuaVe);
      }

      const chuyenVe = await moChuyen('Chiều về', 1);
      const gioVe = chuyenVe.match(/\b\d{1,2}:\d{2}\b/)![0];
      await datSoKhach(1);
      const gheVe = nhanh.ma === 'BACK-POINTS' || nhanh.ma === 'BACK-CONTACT'
        ? await docLuaChonGheVe() : null;
      await bamVaDongQuyDinh(buocChonCho(), sauChonCho(hoTen));
      if (await buocChonDiem().isVisible()) await chonDiemConThieu();
      console.log('TC-BOOK-020 - Dữ liệu chạy:', {
        nhanh: nhanh.ma, nhaXe, ngayDi: ngayDi.hienThi, ngayVe: ngayVe.hienThi,
        tuyen: 'Hà Nội ↔ Hải Phòng', dangNhap: false, chuyenDi, chuyenVe,
      });

      if (nhanh.ma === 'BACK-POINTS' || nhanh.ma === 'RELOAD-POINTS') {
        test.skip(!(await buocChonDiem().isVisible()), 'Chuyến này tự chuyển tới liên hệ, không có bước chọn điểm chiều về.');
        await expect(ketQuaVe, 'Phải đang chọn điểm đón/trả của chuyến chiều về').toBeVisible();
      }

      if (nhanh.ma === 'RELOAD-POINTS') {
        await thuF5(false);
      } else if (nhanh.ma === 'BACK-POINTS') {
        const diemTruoc = await docDiemDangChon();
        await page.screenshot({ path: anh('BEFORE-BACK'), fullPage: true });
        await bamQuayLai(khungDatVe());
        await doiChieuGheVe(gheVe!, gioVe);
        await page.screenshot({ path: anh('AFTER-BACK'), fullPage: true });

        await bamVaDongQuyDinh(buocChonCho(), sauChonCho(hoTen));
        if (await buocChonDiem().isVisible()) {
          const diemSau = await docDiemDangChon();
          expect(diemSau, 'Tiếp tục trở lại phải giữ điểm đón/trả đã chọn').toEqual(diemTruoc);
          console.log('TC-BOOK-020 - Điểm được giữ sau Quay lại:', diemSau);
        } else {
          await doiChieuDiemTrenTheVe(diemTruoc);
        }
      } else {
        const diemTruoc = await buocChonDiem().isVisible() ? await docDiemDangChon() : null;
        await denLienHe();
        await nhapLienHe();
        if (nhanh.ma === 'RELOAD-CONTACT') {
          await thuF5(true);
        } else {
          const chuyenTruoc = await docChuyenTaiLienHe();
          await page.screenshot({ path: anh('BEFORE-BACK'), fullPage: true });
          const chuyenDangChon = page.getByText('CHUYẾN ĐANG CHỌN', { exact: true })
            .locator('xpath=ancestor::*[.//button[normalize-space(.)="Chỉnh sửa"]][1]');
          const nutSuaChuyen = chuyenDangChon
            .getByRole('button', { name: 'Chỉnh sửa', exact: true }).filter({ visible: true });
          const buocTruoc = buocChonCho().or(buocChonDiem()).first();
          await bamQuayLai(page.locator('body'));
          await expect(buocTruoc.or(nutSuaChuyen).filter({ visible: true }).first(),
            'Quay lại phải giữ bước trước hoặc thẻ chuyến đang chọn').toBeVisible({ timeout: 30000 });
          await page.screenshot({ path: anh('AFTER-BACK'), fullPage: true });

          if (!(await buocTruoc.isVisible())) {
            await expect(ketQuaVe).toBeVisible();
            await expect(chuyenDangChon).toContainText(nhaXe);
            await expect(chuyenDangChon).toContainText(gioVe);
            await nutSuaChuyen.click();
            await expect(buocTruoc, 'Chỉnh sửa phải mở lại chuyến chiều về đã chọn').toBeVisible();
          }
          if (await buocChonCho().isVisible()) {
            await doiChieuGheVe(gheVe!, gioVe);
            await bamVaDongQuyDinh(buocChonCho(), sauChonCho(hoTen));
          }
          if (diemTruoc && await buocChonDiem().isVisible()) {
            expect(await docDiemDangChon(), 'Quay lại phải giữ các điểm đã chọn').toEqual(diemTruoc);
          }
          await denLienHe();
          expect(await docChuyenTaiLienHe(), 'Mở lại liên hệ phải giữ lựa chọn hai chiều').toEqual(chuyenTruoc);
          await expect.poll(docLienHe, { message: 'Mở lại liên hệ phải giữ đủ ba trường đã nhập' }).toEqual(duLieuLienHe);
        }
      }
      await expect(thongBaoLoi).toHaveCount(0);
      ketQua = 'PASS';
    } catch (error) {
      if (testInfo.expectedStatus === 'skipped') ketQua = 'SKIP';
      throw error;
    } finally {
      console.log('TC-BOOK-020 - ' + nhanh.ma + ':', ketQua);
      if (!page.isClosed()) await page.screenshot({ path: anh(ketQua), fullPage: true });
    }
  });
}
