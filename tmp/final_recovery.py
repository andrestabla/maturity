import os

def recover_workspace():
    path = "/Users/andrestabla/Documents/Maturity/src/pages/CourseWorkspacePage.tsx"
    with open(path, "r") as f:
        content = f.read()

    # The broken block I created:
    broken_block = """    getInstitutionFaculties(appData.institution, currentInstitution);
    getInstitutionPrograms(appData.institution, currentInstitution);
    getInstitutionAcademicPeriods(appData.institution, currentInstitution);
    getInstitutionCourseTypes(appData.institution, currentInstitution);
  getInstitutionPedagogicalGuidelines("""

    # The correct block (with assignments):
    correct_block = """  const facultyOptions = uniqueOptions(
    getInstitutionFaculties(appData.institution, currentInstitution),
  );
  const programOptions = uniqueOptions(
    getInstitutionPrograms(appData.institution, currentInstitution),
  );
  const academicPeriodOptions = uniqueOptions(
    getInstitutionAcademicPeriods(appData.institution, currentInstitution),
  );
  const courseTypeOptions = uniqueOptions(
    getInstitutionCourseTypes(appData.institution, currentInstitution),
  );
  getInstitutionPedagogicalGuidelines("""

    if broken_block in content:
        content = content.replace(broken_block, correct_block)
        with open(path, "w") as f:
            f.write(content)
        print("CourseWorkspacePage.tsx recovered.")
    else:
        # Try a slightly different match if my multi_replace was weird
        print("Could not find the exact broken block in CourseWorkspacePage.tsx.")

def recover_library():
    path = "/Users/andrestabla/Documents/Maturity/src/pages/LibraryPage.tsx"
    with open(path, "r") as f:
        content = f.read()

    # The broken block:
    broken_block = """        },
      }));
        ...current,
        [editingResource.id]: tagsToInput(editingResource.tags),
      }));
    }"""

    # The correct block:
    correct_block = """        },
      }));
    }"""

    if broken_block in content:
        content = content.replace(broken_block, correct_block)
        with open(path, "w") as f:
            f.write(content)
        print("LibraryPage.tsx recovered.")
    else:
        print("Could not find the exact broken block in LibraryPage.tsx.")

if __name__ == "__main__":
    recover_workspace()
    recover_library()
