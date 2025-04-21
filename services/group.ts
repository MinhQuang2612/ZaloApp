import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { joinGroup } from "./socket";

export interface Group {
  groupID: string;
  groupName: string;
}

export interface GroupMember {
  groupID: string;
  userID: string;
  memberRole: "LEADER" | "MEMBER";
}

export const createGroup = async (data: { groupName: string; userID: string }): Promise<Group> => {
  try {
    const response = await api.post("/api/group", data);
    const groupData = response.data.group;

    // Lưu thông tin nhóm vào AsyncStorage
    const storedGroups = await AsyncStorage.getItem("userGroups");
    const groups: Group[] = storedGroups ? JSON.parse(storedGroups) : [];
    const newGroup: Group = { groupID: groupData.groupID, groupName: groupData.groupName };
    const groupExists = groups.some((g) => g.groupID === groupData.groupID);
    if (!groupExists) {
      groups.push(newGroup);
      await AsyncStorage.setItem("userGroups", JSON.stringify(groups));
      console.log("Đã lưu nhóm vào AsyncStorage:", newGroup);
    }

    // Bỏ kiểm tra thành viên và gọi joinGroup, vì server đã tự động thêm user làm LEADER
    return newGroup;
  } catch (error: any) {
    console.error("Lỗi khi tạo nhóm:", error.message);
    throw error;
  }
};

export const fetchUserGroups = async (userID: string): Promise<Group[]> => {
  try {
    // Lấy danh sách nhóm mà user tham gia
    const userGroupsResponse = await api.get(`/api/group/${userID}`);
    console.log("Dữ liệu từ API /api/group/:userID:", userGroupsResponse.data);
    if (!userGroupsResponse.data || !Array.isArray(userGroupsResponse.data)) {
      console.error("Dữ liệu trả về không phải mảng:", userGroupsResponse.data);
      return [];
    }

    // Lấy danh sách tất cả nhóm để lấy groupName
    const allGroupsResponse = await api.get(`/api/group`);
    const allGroups = allGroupsResponse.data.data || [];
    console.log("Dữ liệu từ API /api/group:", allGroups);

    // Lấy danh sách nhóm từ AsyncStorage
    const storedGroups = await AsyncStorage.getItem("userGroups");
    const localGroups: Group[] = storedGroups ? JSON.parse(storedGroups) : [];

    // Kết hợp dữ liệu
    const groups = userGroupsResponse.data.map((item: { groupID: string }) => {
      // Tìm groupName từ API /api/group
      const groupDetail = allGroups.find((g: { groupID: string }) => g.groupID === item.groupID);
      // Tìm groupName từ AsyncStorage nếu API không có
      const localGroup = localGroups.find((g) => g.groupID === item.groupID);

      return {
        groupID: item.groupID,
        groupName: groupDetail?.groupName || localGroup?.groupName || "Nhóm không tên",
      };
    });

    console.log("Danh sách nhóm sau khi kết hợp:", groups);
    return groups;
  } catch (error: any) {
    console.error("Lỗi khi lấy danh sách nhóm:", error.message);

    // Nếu API thất bại, dựa hoàn toàn vào AsyncStorage
    const storedGroups = await AsyncStorage.getItem("userGroups");
    const localGroups: Group[] = storedGroups ? JSON.parse(storedGroups) : [];
    return localGroups;
  }
};