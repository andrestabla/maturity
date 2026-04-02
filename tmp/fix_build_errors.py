import os
import re

def fix_user_profile_page():
    path = "/Users/andrestabla/Documents/Maturity/src/pages/UserProfilePage.tsx"
    with open(path, "r") as f:
        content = f.read()
    
    # Fix the tags that got duplicated props
    # Pattern: <SidePanel isOpen={true} width="xl" sideLabel="Perfil" sideDescription="AJUSTES" title="..." description="..." width="xl" onClose={...}
    # We want to keep only one of each.
    
    # 1. First SidePanel (Profile Editor)
    content = content.replace(
        '<SidePanel isOpen={true} width="xl" sideLabel="Perfil" sideDescription="AJUSTES"\n              title="Editar información personal"\n              description="La edición se resuelve en modal para que la vista de perfil permanezca limpia."\n              width="xl"',
        '<SidePanel isOpen={true} width="xl" sideLabel="Perfil" sideDescription="AJUSTES"\n              title="Editar información personal"\n              description="La edición se resuelve en modal para que la vista de perfil permanezca limpia."'
    )

    # 2. Second SidePanel (Admin Access)
    content = content.replace(
        '<SidePanel isOpen={true} width="xl" sideLabel="Perfil" sideDescription="AJUSTES"\n              title="Editar acceso, roles y alcance"\n              description="Los cambios administrativos se resuelven fuera de la página para evitar saturación."\n              width="xl"',
        '<SidePanel isOpen={true} width="xl" sideLabel="Perfil" sideDescription="AJUSTES"\n              title="Editar acceso, roles y alcance"\n              description="Los cambios administrativos se resuelven fuera de la página para evitar saturación."'
    )

    # 3. Third SidePanel (Password Editor)
    # Note: This one had width="lg" but my script added width="xl"
    content = content.replace(
        '<SidePanel isOpen={true} width="xl" sideLabel="Perfil" sideDescription="AJUSTES"\n              title="Actualizar contraseña"\n              description="La seguridad se edita en modal para mantener el perfil como vista de lectura."\n              width="lg"',
        '<SidePanel isOpen={true} width="lg" sideLabel="Perfil" sideDescription="AJUSTES"\n              title="Actualizar contraseña"\n              description="La seguridad se edita en modal para mantener el perfil como vista de lectura."'
    )

    with open(path, "w") as f:
        f.write(content)
    print("UserProfilePage.tsx fixed.")

def fix_team_page():
    path = "/Users/andrestabla/Documents/Maturity/src/pages/TeamPage.tsx"
    with open(path, "r") as f:
        lines = f.readlines()
    
    new_lines = []
    side_panel_imported = False
    for line in lines:
        if "import { SidePanel }" in line:
            if not side_panel_imported:
                new_lines.append(line)
                side_panel_imported = True
            else:
                continue # Skip duplicate import
        else:
            line = line.replace('variant="drawer" ', '')
            line = line.replace('variant="drawer"', '')
            new_lines.append(line)
            
    with open(path, "w") as f:
        f.writelines(new_lines)
    print("TeamPage.tsx fixed.")

def fix_library_page():
    path = "/Users/andrestabla/Documents/Maturity/src/pages/LibraryPage.tsx"
    with open(path, "r") as f:
        lines = f.readlines()
    
    new_lines = []
    for line in lines:
        if any(x in line for x in ["setNewTagInput", "setTagInputs", "newTagInput", "tagInputs"]):
            if "onChange" in line: # Be careful not to break the whole line if it's mixed
                 line = re.sub(r'setNewTagInput\(.*?\);?\s*', '', line)
                 line = re.sub(r'setTagInputs\(.*?\);?\s*', '', line)
                 if line.strip(): new_lines.append(line)
            else:
                 continue # Skip technical setup lines for these variables
        else:
            new_lines.append(line)
            
    with open(path, "w") as f:
        f.writelines(new_lines)
    print("LibraryPage.tsx fixed.")

def fix_workspace_page():
    path = "/Users/andrestabla/Documents/Maturity/src/pages/CourseWorkspacePage.tsx"
    with open(path, "r") as f:
        lines = f.readlines()
    
    new_lines = []
    for line in lines:
        if any(x in line for x in ["const facultyOptions =", "const programOptions =", "const academicPeriodOptions =", "const courseTypeOptions ="]):
            continue
        new_lines.append(line)
            
    with open(path, "w") as f:
        f.writelines(new_lines)
    print("CourseWorkspacePage.tsx fixed.")

if __name__ == "__main__":
    fix_user_profile_page()
    fix_team_page()
    fix_library_page()
    fix_workspace_page()
