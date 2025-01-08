// /api/chapter/getInto
// /api/chapter/getInfo

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import javax.validation.Valid;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/chapter")
public class ChapterController {

    @Autowired
    private ChapterRepository chapterRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private YoutubeService youtubeService;

    @Autowired
    private GPTService gptService;

    @PostMapping("/getInfo")
    public ResponseEntity<?> getChapterInfo(@Valid @RequestBody ChapterInfoRequest request) {
        try {
            String chapterId = request.getChapterId();

            // Fetch chapter details
            Optional<Chapter> chapterOpt = chapterRepository.findById(chapterId);
            if (chapterOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of(
                        "success", false,
                        "error", "Chapter not found"
                ));
            }
            Chapter chapter = chapterOpt.get();

            // Fetch video ID and transcript
            String videoId = youtubeService.searchYoutube(chapter.getYoutubeSearchQuery());
            String transcript = youtubeService.getTranscript(videoId);

            // Truncate transcript to max length
            int maxLength = 500;
            String[] words = transcript.split(" ");
            if (words.length > maxLength) {
                transcript = String.join(" ", Arrays.copyOf(words, maxLength));
            }

            // Generate summary using GPT service
            String summary = gptService.summarizeTranscript(
                    "You are an AI capable of summarizing a YouTube transcript",
                    "Summarize in 250 words or less and do not talk about sponsors or anything unrelated to the main topic. Do not introduce what the summary is about.\n" + transcript
            );

            // Generate questions from transcript
            List<Question> questions = youtubeService.generateQuestionsFromTranscript(transcript, chapter.getName());

            // Save questions to the database
            List<Question> savedQuestions = questions.stream().map(question -> {
                List<String> options = new ArrayList<>(List.of(
                        question.getAnswer(),
                        question.getOption1(),
                        question.getOption2(),
                        question.getOption3()
                ));
                Collections.shuffle(options);
                return new Question(question.getQuestion(), question.getAnswer(),
                        new Gson().toJson(options), chapter);
            }).collect(Collectors.toList());
            questionRepository.saveAll(savedQuestions);

            // Update chapter with videoId and summary
            chapter.setVideoId(videoId);
            chapter.setSummary(summary);
            chapterRepository.save(chapter);

            return ResponseEntity.ok(Map.of("success", true));

        } catch (ValidationException e) {
            return ResponseEntity.status(400).body(Map.of(
                    "success", false,
                    "error", "Invalid body"
            ));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "error", "unknown"
            ));
        }
    }
}
