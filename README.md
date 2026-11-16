Hướng dẫn Automation test:<br>
**B1:** Xem testcase nào nên tự động, testcase nào nên manual.<br>
**B2:** <br>
tạo file , ví dụ: tc-search-001.spec.ts<br>
tạo code: npx playwright codegen https://vexere.com/   insert code vô file đã tạo<br>

execute: npx playwright test tests/search/tc-search-001.spec.ts --project=chromium --headed --workers=1<br>

chạy hết tất cả các testcase: npx playwright test --project=chromium --workers=1<br>

**B3:** chạy kết quả: npx playwright show-report<br>

**GHI NHẬN KẾT QUẢ VÔ FILE EXCEL.**
