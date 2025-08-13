### [GENERAL] Proposal title
**Answer:** *X150-Valkyrie: Advanced Wallet with Offline Signing*

### [GENERAL] Name and surname of main applicant
**Answer:** *Son*

### [GENERAL] Are you delivering this project as an individual or as an entity (whether formally incorporated or not)
**Answer:** *Nera*

### [GENERAL] Requested funds in ada
**Answer:** *₳187,500*

*(Note: This is based on a $75,000 USD budget at a hypothetical rate of $0.40/ADA. The final ADA amount will be calculated based on the rate at the time of funding, as per Catalyst guidelines. This fits within the ₳200,000 limit for a technical developer project in the Cardano Open category).*

### [GENERAL] Please specify how many months you expect your project to last (from 2-12 months)
**Answer:** *6 months*

### [GENERAL] Please indicate if your proposal has been auto-translated into English from another language
**Answer:** *NO*

### [GENERAL] What is the problem you want to solve? (200-character limit including spaces)
**Answer:** *Mobile wallets force users to choose between convenience and security. This lack of advanced, safe options on mobile hinders adoption for experienced users and puts new users at risk.*

### [GENERAL] Summarize your solution to the problem (200-character limit including spaces)
**Answer:** *We will deliver X150-Valkyrie, a free, open-source mobile wallet with offline signing, multi-sig, and NFT support, providing hardware-wallet level security for all Cardano users.*

### [GENERAL] Does your project have any dependencies on other organizations, technical or otherwise?
**Answer:** *YES*

### [GENERAL] If YES, please describe what the dependency is and why you believe it is essential for your project’s delivery. If NO, please write “No dependencies.”
**Answer:** *The project depends on a third-party blockchain data provider (e.g., Blockfrost) for real-time on-chain information like transaction status, balances, and UTXOs. This is essential as the wallet needs to read data from the Cardano blockchain. To mitigate risk, our service layer is designed to be adaptable, allowing us to switch to an alternative API provider or a self-hosted node with minimal disruption if our primary provider experiences significant downtime.*

### [GENERAL] Will your project’s output/s be fully open source?
**Answer:** *YES*

### [GENERAL] Please provide here more information on the open source status of your project outputs
**Answer:** *The entire mobile application codebase for both iOS and Android will be made publicly available on GitHub under the MIT License. This includes all services, UI components, and utility functions. This ensures full transparency, allows for independent security audits by the community, and encourages other developers to contribute to or build upon our work, strengthening the entire ecosystem.*

### [SOLUTION] Please describe your proposed solution
**Answer:** *The X150-Valkyrie wallet is architected to solve the critical security-convenience trade-off on mobile. Our solution is a native mobile application for iOS and Android that delivers a suite of advanced features without compromising on security.

Our approach is built on three pillars:

1.  **Airtight, "Air-Gapped" Security:** The core of our solution is offline transaction signing. Users can keep their primary device with the Valkyrie wallet completely offline. A transaction can be created, and then its unsigned data is transferred via QR code to the offline wallet. The wallet signs it using the securely stored private keys, and the safe, signed transaction data is transferred back to an online device for broadcasting. This process mimics the security model of a hardware wallet, ensuring private keys are never exposed to an online environment.

2.  **A Hub for Power Users:** We go beyond basic sending and receiving. Valkyrie will have built-in, first-class support for:
    *   **Multi-Signature (Multi-sig):** Create and manage shared wallets that require multiple approvals for transactions, essential for businesses and groups.
    *   **NFT Gallery:** A visually rich and intuitive interface to view and manage Cardano NFTs.
    *   **DeFi & Staking Dashboard:** A central place to manage staking delegations and interact with DeFi protocols.
    *   **Portfolio Analytics:** Provide users with insights into their asset performance.

3.  **Intuitive User Experience:** Advanced features are integrated into a clean, user-friendly interface. We aim to make complex actions like multi-sig setup or offline signing feel straightforward and accessible, empowering both new and experienced users to take control of their assets securely.

By delivering this, we provide a single, trusted, and free application that can serve as a user's primary mobile interface to the Cardano ecosystem.*

### [IMPACT] Please define the positive impact your project will have on the wider Cardano community
**Answer:** *The success of X150-Valkyrie will bring direct, measurable value to the Cardano community in several key ways:

1.  **Drastically Improved User Security:** By making hardware-wallet level security free and accessible on mobile, we will reduce the risk of fund loss from phishing, malware, and other online attacks. This builds a safer environment for all users.
2.  **Increased Power-User Engagement:** Providing tools like multi-sig and detailed analytics on mobile empowers the most active members of the community (builders, traders, business owners) to manage their operations on the go, increasing overall ecosystem activity.
3.  **A Trusted, Open-Source Public Good:** An audited, open-source wallet becomes a foundational piece of infrastructure. It serves as a benchmark for security and a trusted resource that can be recommended to new users, enhancing Cardano's reputation for security and reliability.

**How we will measure impact (KPIs):**
*   **Quantitative:**
    *   Downloads: Achieve 5,000+ downloads within 6 months of launch.
    *   Active Users: Reach 2,500+ monthly active users within 6 months.
    *   App Store Rating: Maintain an average rating of 4.5+ stars.
    *   GitHub Engagement: 100+ stars/forks on our public repository.
*   **Qualitative:**
    *   Successful completion and publication of a third-party security audit report.
    *   Positive user feedback and reviews focusing on security and ease of use.
    *   Adoption of advanced features, measured via opt-in analytics.

**How we will share outputs:**
*   The full, audited codebase will be on GitHub.
*   The final security audit report will be publicly available.
*   We will publish a detailed project close-out report and video, sharing our journey, learnings, and results with the Catalyst community.*

### [CAPABILITY & FEASIBILITY] What is your capability to deliver your project with high levels of trust and accountability? How do you intend to validate if your approach is feasible?
**Answer:** *Our capability is demonstrated by the significant progress already made on the X150-Valkyrie wallet. We are not starting from an idea; we are presenting a well-architected, substantially developed application. The detailed code review conducted by the Gemini agent confirms a strong technical foundation, adherence to best practices (strict TypeScript, clear architecture), and a deep understanding of Cardano's protocols.

**Trust and Accountability:**
*   **Team Capability:** The Nera entity (Valkyrie Team) consists of experienced mobile engineers with a proven history of delivering complex applications. Our lead, Son, has direct experience with blockchain protocols and secure application design.
*   **Fund Management:** All funds will be managed with full transparency. They will be held in a Cardano multi-signature wallet requiring approval from at least two team members for any disbursement. Funds will only be moved to cover expenses directly outlined in our budget and tied to the completion of public milestones.
*   **Feasibility Validation:** The core functionalities, including key derivation, transaction building, and signing with the Cardano Serialization Library, are already implemented and working on testnet. The primary remaining work involves UI refinement, rigorous testing, and the crucial third-party audit, which validates the security of our approach.*

### [PROJECT MILESTONES] What are the key milestones you need to achieve in order to complete your project successfully?
**Answer:** 
*   **Month 1: Project Setup & Audit Engagement**
    *   Finalize detailed development and testing plans.
    *   Establish the multi-sig treasury wallet for fund management.
    *   Select and formally engage a reputable third-party security audit firm.
    *   **Deliverable:** Public announcement of the selected audit partner.

*   **Month 2: Feature Finalization & Audit Prep**
    *   Complete UI/UX for all remaining advanced features (Multi-sig, DeFi dashboard).
    *   Conduct intensive internal QA and bug fixing cycles.
    *   Provide the complete codebase to the auditors to begin their review.
    *   **Deliverable:** A feature-complete beta version available for community testers.

*   **Month 3: Security Audit & Remediation**
    *   Work closely with auditors to answer questions and provide context.
    *   Begin implementing fixes for any findings from the audit in real-time.
    *   **Deliverable:** An interim report summarizing the audit's progress and any critical findings addressed.

*   **Month 4: Final Polish & Public Code Release**
    *   Implement all final recommendations from the security audit.
    *   Prepare all materials for App Store and Play Store submission.
    *   **Deliverable:** The complete, audited codebase is released on GitHub under an MIT license.

*   **Month 5: Public Launch**
    *   Launch X150-Valkyrie on the Apple App Store and Google Play Store.
    *   Initiate marketing and community outreach campaigns.
    *   Establish user support channels.
    *   **Deliverable:** Links to the live application on both app stores.

*   **Month 6: Community Growth & Project Close-out**
    *   Monitor user feedback, fix bugs, and plan the first post-launch update.
    *   Publish the final, full security audit report.
    *   **Deliverable:** A comprehensive Project Close-out report and video detailing achievements, KPIs, and future plans, submitted to the Catalyst platform.*

### [RESOURCES] Who is in the project team and what are their roles?
**Answer:** 
*   **Son - Project Lead & Lead Backend/Blockchain Developer:** Responsible for the overall project strategy, blockchain logic, security architecture, and managing the open-source repository.
*   **[Name of Frontend Developer] - Lead Frontend/UI Developer:** Responsible for all aspects of the React Native user interface, ensuring a polished and intuitive user experience on both iOS and Android. *(We are actively confirming this role and will finalize upon funding approval).*

We have a direct line of communication with our intended team members. The core logic has been primarily developed by Son, demonstrating capability. We will recruit the frontend developer based on their proven experience with React Native and their passion for creating excellent user experiences.

### [BUDGET & COSTS] Please provide a cost breakdown of the proposed work and resources
**Answer:** 
*   **Third-Party Security Audit: ₳62,500 ($25,000)**
    *   A comprehensive security audit is our top priority and essential for a wallet. This covers a full review of our codebase and cryptographic implementations.
*   **Lead Developer (1): ₳60,000 ($24,000)**
    *   (₳10,000/month for 6 months). For implementing audit feedback, managing the project, and overseeing the open-source community.
*   **Frontend/UI Developer (1): ₳45,000 ($18,000)**
    *   (₳7,500/month for 6 months). For UI/UX polishing, bug fixes, and post-launch improvements.
*   **Marketing & Community Engagement: ₳12,500 ($5,000)**
    *   For creating tutorials, guides, and running modest campaigns to drive initial adoption.
*   **Contingency Fund: ₳7,500 ($3,000)**
    *   To cover unforeseen costs or extend development time if required by audit findings.
*   **TOTAL: ₳187,500 ($75,000)**

### [VALUE FOR MONEY] How does the cost of the project represent value for money for the Cardano ecosystem?
**Answer:** *This project delivers exceptional value for money by creating a foundational piece of public infrastructure. A free, open-source, and highly secure mobile wallet directly enhances the value of the Cardano network for every single user.

The cost is not for a speculative venture but for hardening and delivering an already-developed product. The primary expense, the security audit, is a direct investment in user safety and trust for the entire ecosystem. For a modest cost, the community receives a production-ready, audited, and advanced wallet that can prevent potentially millions in user funds from being lost to security breaches. This elevates the standard for mobile security on Cardano and provides a powerful tool that empowers users and developers alike, representing a strategic and high-leverage investment in the long-term health and reputation of the ecosystem.*
