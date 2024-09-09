const GalleryPage = async (props: Props) => {
  let courses = [];
  try {
    courses = await prisma.course.findMany({
      include: {
        units: {
          include: { chapters: true },
        },
      },
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
  }
  return (
    <div className="py-8 mx-auto max-w-7xl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 place-items-center">
        {courses.length > 0 ? (
          courses.map((course) => (
            <GalleryCourseCard course={course} key={course.id} />
          ))
        ) : (
          <p>No courses available.</p>
        )}
      </div>
    </div>
  );
};
