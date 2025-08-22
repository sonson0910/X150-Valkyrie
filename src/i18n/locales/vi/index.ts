/**
 * Vietnamese translations
 */

export default {
    common: {
        ok: 'Đồng ý',
        cancel: 'Hủy',
        confirm: 'Xác nhận',
        delete: 'Xóa',
        edit: 'Chỉnh sửa',
        save: 'Lưu',
        close: 'Đóng',
        back: 'Quay lại',
        next: 'Tiếp theo',
        previous: 'Trước đó',
        loading: 'Đang tải...',
        error: 'Lỗi',
        success: 'Thành công',
        warning: 'Cảnh báo',
        info: 'Thông tin',
        yes: 'Có',
        no: 'Không',
        copy: 'Sao chép',
        paste: 'Dán',
        share: 'Chia sẻ',
        send: 'Gửi',
        receive: 'Nhận',
        amount: 'Số lượng',
        address: 'Địa chỉ',
        balance: 'Số dư',
        transaction: 'Giao dịch',
        wallet: 'Ví',
        password: 'Mật khẩu',
        mnemonic: 'Cụm từ khôi phục',
        account: 'Tài khoản',
        settings: 'Cài đặt'
    },

    auth: {
        biometric: {
            title: 'Xác thực sinh trắc học',
            subtitle: 'Vui lòng xác thực để tiếp tục',
            fallback: 'Sử dụng mật khẩu',
            error: 'Xác thực thất bại',
            notAvailable: 'Xác thực sinh trắc học không khả dụng',
            notEnrolled: 'Chưa đăng ký thông tin sinh trắc học'
        },
        password: {
            enter: 'Nhập mật khẩu',
            confirm: 'Xác nhận mật khẩu',
            current: 'Mật khẩu hiện tại',
            new: 'Mật khẩu mới',
            weak: 'Mật khẩu yếu',
            medium: 'Mật khẩu trung bình',
            strong: 'Mật khẩu mạnh',
            mismatch: 'Mật khẩu không khớp',
            required: 'Vui lòng nhập mật khẩu',
            minLength: 'Mật khẩu phải có ít nhất {{length}} ký tự'
        }
    },

    wallet: {
        create: {
            title: 'Tạo ví mới',
            subtitle: 'Thiết lập ví Cardano của bạn',
            generateMnemonic: 'Tạo cụm từ khôi phục',
            writeMnemonic: 'Ghi lại cụm từ khôi phục',
            confirmMnemonic: 'Xác nhận cụm từ khôi phục',
            setPassword: 'Đặt mật khẩu ví',
            success: 'Tạo ví thành công',
            warning: 'Lưu trữ cụm từ khôi phục an toàn',
            mnemonicWarning: 'Đây là cụm từ khôi phục của bạn. Hãy ghi lại và lưu trữ ở nơi an toàn. Không bao giờ chia sẻ với ai.'
        },
        restore: {
            title: 'Khôi phục ví',
            subtitle: 'Khôi phục từ cụm từ khôi phục',
            enterMnemonic: 'Nhập cụm từ khôi phục',
            invalidMnemonic: 'Cụm từ khôi phục không hợp lệ',
            success: 'Khôi phục ví thành công'
        },
        home: {
            title: 'Ví',
            totalBalance: 'Tổng số dư',
            availableBalance: 'Khả dụng',
            stakingBalance: 'Đang stake',
            recentTransactions: 'Giao dịch gần đây',
            noTransactions: 'Chưa có giao dịch nào',
            viewAll: 'Xem tất cả'
        },
        send: {
            title: 'Gửi ADA',
            recipient: 'Địa chỉ người nhận',
            amount: 'Số lượng gửi',
            fee: 'Phí mạng',
            total: 'Tổng cộng',
            memo: 'Ghi chú (tùy chọn)',
            confirm: 'Xác nhận giao dịch',
            success: 'Gửi giao dịch thành công',
            insufficientFunds: 'Số dư không đủ',
            invalidAddress: 'Địa chỉ người nhận không hợp lệ',
            invalidAmount: 'Số lượng không hợp lệ'
        },
        receive: {
            title: 'Nhận ADA',
            yourAddress: 'Địa chỉ của bạn',
            copied: 'Đã sao chép địa chỉ',
            share: 'Chia sẻ địa chỉ',
            qrCode: 'Mã QR'
        },
        transactions: {
            title: 'Lịch sử giao dịch',
            sent: 'Đã gửi',
            received: 'Đã nhận',
            pending: 'Đang xử lý',
            confirmed: 'Đã xác nhận',
            failed: 'Thất bại',
            details: 'Chi tiết giao dịch',
            hash: 'Hash giao dịch',
            fee: 'Phí',
            date: 'Ngày',
            block: 'Block',
            confirmations: 'Xác nhận',
            empty: 'Không tìm thấy giao dịch'
        }
    },

    staking: {
        title: 'Staking',
        delegate: 'Ủy quyền',
        undelegate: 'Hủy ủy quyền',
        rewards: 'Phần thưởng',
        pool: 'Pool stake',
        selectPool: 'Chọn pool stake',
        delegated: 'Đã ủy quyền',
        notDelegated: 'Chưa ủy quyền',
        epoch: 'Epoch',
        roi: 'Lợi tức đầu tư',
        claim: 'Nhận phần thưởng',
        rewardsAvailable: 'Phần thưởng khả dụng'
    },

    nft: {
        title: 'Bộ sưu tập NFT',
        empty: 'Không tìm thấy NFT',
        details: 'Chi tiết NFT',
        name: 'Tên',
        description: 'Mô tả',
        policy: 'Policy ID',
        asset: 'Tên asset',
        send: 'Gửi NFT',
        burn: 'Đốt NFT'
    },

    defi: {
        title: 'DeFi',
        pools: 'Pool thanh khoản',
        farming: 'Farming lợi suất',
        addLiquidity: 'Thêm thanh khoản',
        removeLiquidity: 'Rút thanh khoản',
        stake: 'Stake',
        unstake: 'Unstake',
        harvest: 'Thu hoạch',
        apr: 'APR',
        tvl: 'TVL',
        myLiquidity: 'Thanh khoản của tôi'
    },

    settings: {
        title: 'Cài đặt',
        general: 'Chung',
        security: 'Bảo mật',
        network: 'Mạng',
        language: 'Ngôn ngữ',
        currency: 'Tiền tệ',
        theme: 'Giao diện',
        biometric: 'Xác thực sinh trắc học',
        backup: 'Sao lưu ví',
        restore: 'Khôi phục ví',
        export: 'Xuất khóa riêng',
        delete: 'Xóa ví',
        about: 'Về ứng dụng',
        version: 'Phiên bản',
        support: 'Hỗ trợ'
    },

    errors: {
        general: 'Đã xảy ra lỗi',
        network: 'Lỗi mạng',
        timeout: 'Hết thời gian chờ',
        notFound: 'Không tìm thấy',
        unauthorized: 'Không có quyền',
        forbidden: 'Bị cấm',
        serverError: 'Lỗi máy chủ',
        validation: 'Lỗi xác thực',
        unknown: 'Lỗi không xác định',
        retry: 'Thử lại',
        contactSupport: 'Liên hệ hỗ trợ'
    },

    validation: {
        required: 'Trường này là bắt buộc',
        email: 'Vui lòng nhập email hợp lệ',
        phone: 'Vui lòng nhập số điện thoại hợp lệ',
        url: 'Vui lòng nhập URL hợp lệ',
        number: 'Vui lòng nhập số hợp lệ',
        positive: 'Phải là số dương',
        maxLength: 'Tối đa {{max}} ký tự',
        minLength: 'Tối thiểu {{min}} ký tự'
    },

    time: {
        now: 'Bây giờ',
        minute: {
            one: '{{count}} phút trước',
            other: '{{count}} phút trước'
        },
        hour: {
            one: '{{count}} giờ trước',
            other: '{{count}} giờ trước'
        },
        day: {
            one: '{{count}} ngày trước',
            other: '{{count}} ngày trước'
        },
        week: {
            one: '{{count}} tuần trước',
            other: '{{count}} tuần trước'
        },
        month: {
            one: '{{count}} tháng trước',
            other: '{{count}} tháng trước'
        },
        year: {
            one: '{{count}} năm trước',
            other: '{{count}} năm trước'
        }
    },

    numbers: {
        thousand: 'N',
        million: 'Tr',
        billion: 'Tỷ',
        trillion: 'Nghìn tỷ'
    },

    units: {
        ada: 'ADA',
        lovelace: 'lovelace',
        bytes: 'bytes',
        kb: 'KB',
        mb: 'MB',
        gb: 'GB'
    }
};

