// /api/course/createChapters

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import javax.validation.Valid;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/course")
public class CourseController {

    @Autowired
    private AuthService authService;

    @Autowired
    private SubscriptionService subscriptionService;

    @Autowired
    private GPTService gptService;

    @Autowired
    private UnsplashService unsplashService;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private UnitRepository unitRepository;

    @Autowired
    private ChapterRepository chapterRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/createChapters")
    public ResponseEntity<?> createChapters(@Valid @RequestBody CreateChaptersRequest request) {
        try {
            UserSession session = authService.getAuthSession();
            if (session == null || session.getUser() == null) {
                return ResponseEntity.status(401).body("Unauthorized");
            }

            boolean isPro = subscriptionService.checkSubscription(session.getUser());
            if (session.getUser().getCredits() <= 0 && !isPro) {
                return ResponseEntity.status(402).body("No credits");
            }

            // Validate and parse input
            String title = request.getTitle();
            List<String> units = request.getUnits();

            // Generate course content using GPT service
            List<UnitOutput> outputUnits = gptService.generateCourseContent(title, units);

            // Get an image search term and fetch an image
            String imageSearchTerm = gptService.generateImageSearchTerm(title);
            String courseImage = unsplashService.getUnsplashImage(imageSearchTerm);

            // Create course in the database
            Course course = new Course(title, courseImage);
            courseRepository.save(course);

            for (UnitOutput unitOutput : outputUnits) {
                Unit unit = new Unit(unitOutput.getTitle(), course);
                unitRepository.save(unit);

                List<Chapter> chapters = unitOutput.getChapters().stream().map(chapterOutput ->
                        new Chapter(chapterOutput.getChapterTitle(), chapterOutput.getYoutubeSearchQuery(), unit)
                ).toList();
                chapterRepository.saveAll(chapters);
            }

            // Update user credits
            User user = session.getUser();
            user.setCredits(user.getCredits() - 1);
            userRepository.save(user);

            return ResponseEntity.ok(Map.of("course_id", course.getId()));
        } catch (ValidationException e) {
            return ResponseEntity.status(400).body("Invalid body");
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Internal server error");
        }
    }
}

