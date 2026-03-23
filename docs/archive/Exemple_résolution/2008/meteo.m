path='C:\Users\REMY\Downloads\WEEX\Groupe14\Groupe14\2008';
files=dir(strcat(path,'\*.txt'));
L=length(files);

for i=1:L
    close all
    parc=readtable(files(i).name(1:end-4));
    spdraw=parc(:,4);
    dirraw=parc(:,5);
    X2=rows2vars(spdraw);
    X2(:,1)=[];
    spd=table2array(X2);
    Y2=rows2vars(dirraw);
    Y2(:,1)=[];
    ang=table2array(Y2);
    for j=1:length(ang)
        ang(j)=mod((ang(j)+90),365);
    end
    [figure_handle, count, speeds, directions, Table] = WindRose(ang, spd,'vWinds', [0 3 3 9 9 16 16 20 20 25 25 30]);
    saveas(figure_handle,strcat(files(i).name(1:end-4),'.png'))
    i
end

