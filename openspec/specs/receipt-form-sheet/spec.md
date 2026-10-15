# receipt-form-sheet Specification

## Purpose

提供新增與編輯共用的收據表單抽屜（ReceiptFormSheet），涵蓋既有收據資料預填、儲存變更與軟刪除收據的流程。

## Requirements

### Requirement: Unified Receipt Form Sheet
系統 SHALL 提供通用收據表單抽屜（ReceiptFormSheet），同時支援新增收據與編輯既有收據資料。

#### Scenario: 點擊收據卡片進入編輯模式
- **WHEN** 使用者在收據清單中點選任一收據卡片
- **THEN** 系統應開啟 `ReceiptFormSheet` 抽屜，標題顯示「編輯收據 (收據編號)」，並預填該收據的來源、去向、金額、品項明細、備忘、標籤與執行狀態

#### Scenario: 儲存編輯變更
- **WHEN** 使用者在編輯模式下修改品項明細或備忘，並點擊「儲存」
- **THEN** 系統應將更新寫入 IndexedDB，更新圖論引擎數據，並關閉抽屜

#### Scenario: 在抽屜中刪除收據
- **WHEN** 使用者在編輯模式下點擊抽屜左下角的「刪除收據」按鈕並於確認框點擊確認
- **THEN** 系統應軟刪除該筆收據、重新計算帳目並關閉抽屜
