/**
 * English translations
 */

export default {
    common: {
        ok: 'OK',
        cancel: 'Cancel',
        confirm: 'Confirm',
        delete: 'Delete',
        edit: 'Edit',
        save: 'Save',
        close: 'Close',
        back: 'Back',
        next: 'Next',
        previous: 'Previous',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        warning: 'Warning',
        info: 'Information',
        yes: 'Yes',
        no: 'No',
        copy: 'Copy',
        paste: 'Paste',
        share: 'Share',
        send: 'Send',
        receive: 'Receive',
        amount: 'Amount',
        address: 'Address',
        balance: 'Balance',
        transaction: 'Transaction',
        wallet: 'Wallet',
        password: 'Password',
        mnemonic: 'Mnemonic',
        account: 'Account',
        settings: 'Settings'
    },

    auth: {
        biometric: {
            title: 'Biometric Authentication',
            subtitle: 'Please authenticate to continue',
            fallback: 'Use Password',
            error: 'Authentication failed',
            notAvailable: 'Biometric authentication not available',
            notEnrolled: 'No biometric credentials enrolled'
        },
        password: {
            enter: 'Enter Password',
            confirm: 'Confirm Password',
            current: 'Current Password',
            new: 'New Password',
            weak: 'Weak password',
            medium: 'Medium password',
            strong: 'Strong password',
            mismatch: 'Passwords do not match',
            required: 'Password is required',
            minLength: 'Password must be at least {{length}} characters'
        }
    },

    wallet: {
        create: {
            title: 'Create New Wallet',
            subtitle: 'Set up your Cardano wallet',
            generateMnemonic: 'Generate Mnemonic',
            writeMnemonic: 'Write Down Your Recovery Phrase',
            confirmMnemonic: 'Confirm Recovery Phrase',
            setPassword: 'Set Wallet Password',
            success: 'Wallet created successfully',
            warning: 'Store your recovery phrase safely',
            mnemonicWarning: 'This is your recovery phrase. Write it down and store it in a safe place. Never share it with anyone.'
        },
        restore: {
            title: 'Restore Wallet',
            subtitle: 'Restore from recovery phrase',
            enterMnemonic: 'Enter Recovery Phrase',
            invalidMnemonic: 'Invalid recovery phrase',
            success: 'Wallet restored successfully'
        },
        home: {
            title: 'Wallet',
            totalBalance: 'Total Balance',
            availableBalance: 'Available',
            stakingBalance: 'Staking',
            recentTransactions: 'Recent Transactions',
            noTransactions: 'No transactions yet',
            viewAll: 'View All'
        },
        send: {
            title: 'Send ADA',
            recipient: 'Recipient Address',
            amount: 'Amount to Send',
            fee: 'Network Fee',
            total: 'Total',
            memo: 'Memo (optional)',
            confirm: 'Confirm Transaction',
            success: 'Transaction sent successfully',
            insufficientFunds: 'Insufficient funds',
            invalidAddress: 'Invalid recipient address',
            invalidAmount: 'Invalid amount'
        },
        receive: {
            title: 'Receive ADA',
            yourAddress: 'Your Address',
            copied: 'Address copied to clipboard',
            share: 'Share Address',
            qrCode: 'QR Code'
        },
        transactions: {
            title: 'Transaction History',
            sent: 'Sent',
            received: 'Received',
            pending: 'Pending',
            confirmed: 'Confirmed',
            failed: 'Failed',
            details: 'Transaction Details',
            hash: 'Transaction Hash',
            fee: 'Fee',
            date: 'Date',
            block: 'Block',
            confirmations: 'Confirmations',
            empty: 'No transactions found'
        }
    },

    staking: {
        title: 'Staking',
        delegate: 'Delegate',
        undelegate: 'Undelegate',
        rewards: 'Rewards',
        pool: 'Stake Pool',
        selectPool: 'Select Stake Pool',
        delegated: 'Delegated',
        notDelegated: 'Not Delegated',
        epoch: 'Epoch',
        roi: 'Return on Investment',
        claim: 'Claim Rewards',
        rewardsAvailable: 'Rewards Available'
    },

    nft: {
        title: 'NFT Gallery',
        empty: 'No NFTs found',
        details: 'NFT Details',
        name: 'Name',
        description: 'Description',
        policy: 'Policy ID',
        asset: 'Asset Name',
        send: 'Send NFT',
        burn: 'Burn NFT'
    },

    defi: {
        title: 'DeFi',
        pools: 'Liquidity Pools',
        farming: 'Yield Farming',
        addLiquidity: 'Add Liquidity',
        removeLiquidity: 'Remove Liquidity',
        stake: 'Stake',
        unstake: 'Unstake',
        harvest: 'Harvest',
        apr: 'APR',
        tvl: 'TVL',
        myLiquidity: 'My Liquidity'
    },

    settings: {
        title: 'Settings',
        general: 'General',
        security: 'Security',
        network: 'Network',
        language: 'Language',
        currency: 'Currency',
        theme: 'Theme',
        biometric: 'Biometric Authentication',
        backup: 'Backup Wallet',
        restore: 'Restore Wallet',
        export: 'Export Private Key',
        delete: 'Delete Wallet',
        about: 'About',
        version: 'Version',
        support: 'Support'
    },

    errors: {
        general: 'An error occurred',
        network: 'Network error',
        timeout: 'Request timeout',
        notFound: 'Not found',
        unauthorized: 'Unauthorized',
        forbidden: 'Forbidden',
        serverError: 'Server error',
        validation: 'Validation error',
        unknown: 'Unknown error',
        retry: 'Retry',
        contactSupport: 'Contact Support'
    },

    validation: {
        required: 'This field is required',
        email: 'Please enter a valid email',
        phone: 'Please enter a valid phone number',
        url: 'Please enter a valid URL',
        number: 'Please enter a valid number',
        positive: 'Must be a positive number',
        maxLength: 'Maximum {{max}} characters allowed',
        minLength: 'Minimum {{min}} characters required'
    },

    time: {
        now: 'Now',
        minute: {
            one: '{{count}} minute ago',
            other: '{{count}} minutes ago'
        },
        hour: {
            one: '{{count}} hour ago',
            other: '{{count}} hours ago'
        },
        day: {
            one: '{{count}} day ago',
            other: '{{count}} days ago'
        },
        week: {
            one: '{{count}} week ago',
            other: '{{count}} weeks ago'
        },
        month: {
            one: '{{count}} month ago',
            other: '{{count}} months ago'
        },
        year: {
            one: '{{count}} year ago',
            other: '{{count}} years ago'
        }
    },

    numbers: {
        thousand: 'K',
        million: 'M',
        billion: 'B',
        trillion: 'T'
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

