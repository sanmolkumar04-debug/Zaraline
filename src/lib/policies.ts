// Static policy content. Each block: [heading, paragraphs | list items].
type Block = { h?: string; p?: string[]; ol?: string[]; ul?: string[] };

export const POLICIES: Record<string, { title: string; blocks: Block[] }> = {
  "about-us": {
    title: "About Us",
    blocks: [
      { p: ["Zari Lane is a homegrown ethnic-wear label from Surat, India's textile capital. We design and curate lehenga cholis, sarees and festive outfits that bring traditional craft — patola, kalamkari, bandhani, gota patti and zari work — to every celebration."] },
      { h: "What we believe in", ul: ["Honest prices: we work directly with weavers and workshops, so you pay for craft, not for middlemen.", "Quality you can feel: every piece is checked before it is packed.", "Service that listens: our support team is available 24/7 on WhatsApp."] },
      { h: "Registered office", p: ["12, Textile Market Road, Ring Road, Surat - 395002, Gujarat, India."] },
    ],
  },
  "return-policy": {
    title: "Return policy",
    blocks: [
      { h: "Return and Refund Policy" },
      { h: "Cancellation Policy:", ol: ["You can cancel an order any time before it is shipped by contacting us on WhatsApp. Once the product is shipped it cannot be cancelled."] },
      { h: "Return Policy:", ol: ["Returns are accepted within 3 days of delivery for wrong or damaged items. The return window for each product is shown on its product page.", "The return policy for any product may change without prior notice; the policy at the time of your order applies.", "If reverse pick-up is not available at your pincode, you may need to self-ship the product to our office address.", "Refunds for prepaid orders are made to the original payment method within 5-7 working days of the return being approved."] },
      { h: "NOTE FOR RETURN", ul: ["Items must be unused and unwashed, for hygiene reasons.", "Original packaging and tags must be intact; items without tags will not be accepted.", "Customised products cannot be returned or exchanged.", "Return requests raised after the return period will not be accepted."] },
    ],
  },
  "terms-and-conditions": {
    title: "Terms & Conditions",
    blocks: [
      { p: ["By accessing zarilane.in and placing an order you agree to these terms. Please read them carefully."] },
      { h: "Orders & pricing", ul: ["All prices are in Indian Rupees and inclusive of applicable taxes.", "We may cancel an order if a product is out of stock or a pricing error occurs; any amount paid will be refunded in full.", "Offers and coupons are subject to their stated conditions and cannot be combined unless mentioned."] },
      { h: "Payments", ul: ["Online payments are made by scanning our UPI QR code. We never ask for or store your card or bank details, and we confirm each payment manually.", "Cash on Delivery orders must be paid in full at the time of delivery."] },
      { h: "Product images", p: ["Colours may vary slightly from images due to screen settings and photography lighting."] },
      { h: "Governing law", p: ["These terms are governed by the laws of India, and courts at Surat, Gujarat shall have exclusive jurisdiction."] },
    ],
  },
  "privacy-policy": {
    title: "Privacy Policy",
    blocks: [
      { p: ["Your privacy matters to us. This policy explains what we collect and why."] },
      { h: "What we collect", ul: ["Your mobile number to log you in with an OTP.", "Delivery addresses you save, to ship your orders.", "Order and payment status (we only keep the UPI transaction ID you submit)."] },
      { h: "How we use it", ul: ["To process, ship and support your orders.", "To send order updates on WhatsApp/SMS.", "We do not sell your personal data to anyone."] },
      { h: "Your choices", p: ["You can edit or delete saved addresses from your account at any time. To delete your account, message us on WhatsApp."] },
    ],
  },
  "shipping-policy": {
    title: "Shipping Policy",
    blocks: [
      { ul: ["We ship across India. Standard delivery is free and usually takes 3-7 days; Express delivery (1-3 days) is available at checkout for select pincodes.", "Orders are dispatched within 24-48 hours of confirmation.", "You will receive tracking details on WhatsApp/SMS once your order is shipped, and you can follow its progress under My Orders.", "Delivery timelines may be affected by festivals, weather or courier delays beyond our control."] },
    ],
  },
};
