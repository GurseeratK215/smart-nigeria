// /api/stripe

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.stripe.exception.StripeException;
import com.stripe.model.billingportal.Session;
import com.stripe.model.checkout.Session as CheckoutSession;
import com.stripe.param.billingportal.SessionCreateParams;
import com.stripe.param.checkout.SessionCreateParams.LineItem;
import com.stripe.param.checkout.SessionCreateParams.SubscriptionData;
import com.stripe.param.checkout.SessionCreateParams.PaymentMethodType;

import java.util.Optional;

@RestController
@RequestMapping("/api/stripe")
public class StripeController {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserSubscriptionRepository userSubscriptionRepository;

    @Value("${app.settings.url}")
    private String settingsUrl;

    @GetMapping
    public ResponseEntity<?> handleSubscription() {
        try {
            // Verify session
            Optional<User> userOpt = authService.getAuthenticatedUser();
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(401).body("unauthorized");
            }
            User user = userOpt.get();

            // Check for existing subscription
            Optional<UserSubscription> subscriptionOpt = userSubscriptionRepository.findByUserId(user.getId());
            if (subscriptionOpt.isPresent()) {
                UserSubscription subscription = subscriptionOpt.get();

                if (subscription.getStripeCustomerId() != null) {
                    // Create Stripe billing portal session
                    SessionCreateParams params = SessionCreateParams.builder()
                            .setCustomer(subscription.getStripeCustomerId())
                            .setReturnUrl(settingsUrl)
                            .build();

                    Session stripeSession = Session.create(params);
                    return ResponseEntity.ok(Map.of("url", stripeSession.getUrl()));
                }
            }

            // Create Stripe checkout session for new subscription
            CheckoutSessionCreateParams sessionParams = CheckoutSessionCreateParams.builder()
                    .setSuccessUrl(settingsUrl)
                    .setCancelUrl(settingsUrl)
                    .addPaymentMethodType(PaymentMethodType.CARD)
                    .setMode(CheckoutSessionCreateParams.Mode.SUBSCRIPTION)
                    .setBillingAddressCollection(CheckoutSessionCreateParams.BillingAddressCollection.AUTO)
                    .setCustomerEmail(user.getEmail())
                    .addLineItem(
                            LineItem.builder()
                                    .setPriceData(
                                            LineItem.PriceData.builder()
                                                    .setCurrency("usd")
                                                    .setProductData(
                                                            LineItem.PriceData.ProductData.builder()
                                                                    .setName("Learning Journey Pro")
                                                                    .setDescription("unlimited course generation!")
                                                                    .build()
                                                    )
                                                    .setUnitAmount(2000L)
                                                    .setRecurring(
                                                            LineItem.PriceData.Recurring.builder()
                                                                    .setInterval(Recurring.Interval.MONTH)
                                                                    .build()
                                                    )
                                                    .build()
                                    )
                                    .setQuantity(1L)
                                    .build()
                    )
                    .putMetadata("userId", user.getId())
                    .build();

            CheckoutSession stripeSession = CheckoutSession.create(sessionParams);
            return ResponseEntity.ok(Map.of("url", stripeSession.getUrl()));

        } catch (StripeException e) {
            System.err.println("[STRIPE ERROR] " + e.getMessage());
            return ResponseEntity.status(500).body("internal server error");
        }
    }
}
