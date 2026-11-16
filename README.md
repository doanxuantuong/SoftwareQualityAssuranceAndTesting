Hướng dẫn Automation test:
B1: Xem testcase nào nên tự động, testcase nào nên manual.
B2: 
tạo file , ví dụ: tc-search-001.spec.ts
tạo code: npx playwright codegen https://vexere.com/   insert code vô file đã tạo

execute: npx playwright test tests/search/tc-search-001.spec.ts --project=chromium --headed --workers=1

chạy hết tất cả các testcase: npx playwright test --project=chromium --workers=1

B3:
kết quả: npx playwright show-report
